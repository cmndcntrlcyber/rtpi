import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

/**
 * Burp Suite Image Builder
 *
 * Dynamically builds Kasm workspace images for Burp Suite when users
 * upload their JAR files. Creates custom Docker images with user's
 * Burp Suite Professional JAR.
 *
 * Phase 3: Workspace Images (#KW-20, #KW-21)
 */

// ============================================================================
// Type Definitions
// ============================================================================

export type BurpUploadType = 'jar' | 'installer';

export interface BurpJARUpload {
  userId: string;
  jarFileName: string;
  jarFilePath: string;
  jarFileSize: number;
  uploadedAt: Date;
  uploadType: BurpUploadType;
}

export interface BurpImageBuildResult {
  success: boolean;
  imageName: string;
  imageTag: string;
  buildDuration: number;
  buildLog?: string;
  error?: string;
}

export interface BurpImage {
  userId: string;
  imageName: string;
  imageTag: string;
  jarFileName: string;
  createdAt: Date;
  imageSize?: string;
}

// ============================================================================
// Burp Image Builder Class
// ============================================================================

class BurpImageBuilder {
  private uploadDir = process.env.BURP_UPLOAD_DIR || '/tmp/burp-uploads';
  private imageDir = process.env.BURP_IMAGE_DIR || '/tmp/burp-images';
  private baseImageName = 'rtpi/kasm-burp';

  constructor() {
    this.initialize();
  }

  /**
   * Initialize builder
   */
  private async initialize(): Promise<void> {
    console.log('[Burp Builder] Initializing...');

    try {
      // Create directories
      await fs.mkdir(this.uploadDir, { recursive: true });
      await fs.mkdir(this.imageDir, { recursive: true });

      // Create staging directory and clean up orphaned temp files
      const stagingDir = path.join(this.uploadDir, '_staging');
      await fs.mkdir(stagingDir, { recursive: true });

      try {
        const files = await fs.readdir(stagingDir);
        for (const file of files) {
          const filePath = path.join(stagingDir, file);
          const stat = await fs.stat(filePath);
          if (Date.now() - stat.mtimeMs > 3600000) { // 1 hour
            await fs.unlink(filePath).catch(() => {});
            console.log(`[Burp Builder] Cleaned up orphaned staging file: ${file}`);
          }
        }
      } catch {
        // staging dir may be empty or inaccessible
      }

      console.log('[Burp Builder] Initialized successfully');
    } catch (error) {
      console.error('[Burp Builder] Initialization error:', error);
    }
  }

  // ============================================================================
  // JAR Upload Handling (#KW-21)
  // ============================================================================

  /**
   * Process uploaded Burp Suite file (JAR or .sh installer)
   * With diskStorage, file.path is the temp file on disk (no buffer in memory)
   */
  async processJARUpload(
    userId: string,
    jarFile: Express.Multer.File
  ): Promise<BurpJARUpload> {
    const isInstaller = jarFile.originalname.endsWith('.sh');
    const isJar = jarFile.originalname.endsWith('.jar');
    const uploadType: BurpUploadType = isInstaller ? 'installer' : 'jar';

    console.log(`[Burp Builder] Processing ${uploadType} upload for user ${userId}...`);

    try {
      // Validate file type
      if (!isJar && !isInstaller) {
        await fs.unlink(jarFile.path).catch(() => {});
        throw new Error('File must be a .jar or .sh installer file');
      }

      if (jarFile.size > 800 * 1024 * 1024) {
        await fs.unlink(jarFile.path).catch(() => {});
        throw new Error('File too large (max 800MB)');
      }

      // Create user directory
      const userUploadDir = path.join(this.uploadDir, userId);
      await fs.mkdir(userUploadDir, { recursive: true });

      // Determine target filename
      const targetFileName = isInstaller
        ? 'burpsuite_pro_installer.sh'
        : 'burpsuite_pro.jar';
      const targetFilePath = path.join(userUploadDir, targetFileName);

      // Store upload type marker so buildBurpImage knows which Dockerfile to use
      await fs.writeFile(
        path.join(userUploadDir, '.upload-type'),
        uploadType
      );

      try {
        await fs.rename(jarFile.path, targetFilePath);
      } catch {
        console.log('[Burp Builder] rename failed, falling back to copy...');
        await fs.copyFile(jarFile.path, targetFilePath);
        await fs.unlink(jarFile.path).catch(() => {});
      }

      // Make installer executable
      if (isInstaller) {
        await fs.chmod(targetFilePath, 0o755);
      }

      console.log(`[Burp Builder] ${uploadType} saved: ${targetFilePath} (${(jarFile.size / 1024 / 1024).toFixed(1)}MB)`);

      return {
        userId,
        jarFileName: targetFileName,
        jarFilePath: targetFilePath,
        jarFileSize: jarFile.size,
        uploadedAt: new Date(),
        uploadType,
      };
    } catch (error) {
      if (jarFile.path) {
        await fs.unlink(jarFile.path).catch(() => {});
      }
      console.error(`[Burp Builder] Upload failed:`, error);
      throw error;
    }
  }

  /**
   * Get uploaded file info for user (JAR or installer)
   */
  async getUploadedJAR(userId: string): Promise<BurpJARUpload | null> {
    const userDir = path.join(this.uploadDir, userId);

    // Detect upload type from marker file
    let uploadType: BurpUploadType = 'jar';
    try {
      const typeMarker = await fs.readFile(path.join(userDir, '.upload-type'), 'utf-8');
      if (typeMarker.trim() === 'installer') uploadType = 'installer';
    } catch {
      // Default to jar
    }

    const fileName = uploadType === 'installer'
      ? 'burpsuite_pro_installer.sh'
      : 'burpsuite_pro.jar';
    const filePath = path.join(userDir, fileName);

    try {
      const stats = await fs.stat(filePath);
      return {
        userId,
        jarFileName: fileName,
        jarFilePath: filePath,
        jarFileSize: stats.size,
        uploadedAt: stats.mtime,
        uploadType,
      };
    } catch {
      return null;
    }
  }

  /**
   * Delete uploaded JAR for user
   */
  async deleteUploadedJAR(userId: string): Promise<void> {
    console.log(`[Burp Builder] Deleting JAR for user ${userId}...`);

    try {
      const userUploadDir = path.join(this.uploadDir, userId);
      await fs.rm(userUploadDir, { recursive: true, force: true });

      console.log(`[Burp Builder] JAR deleted`);
    } catch (error) {
      console.error(`[Burp Builder] JAR deletion failed:`, error);
      throw error;
    }
  }

  // ============================================================================
  // Docker Image Building (#KW-20)
  // ============================================================================

  /**
   * Build Burp Suite Docker image for user
   */
  async buildBurpImage(userId: string): Promise<BurpImageBuildResult> {
    console.log(`[Burp Builder] Building Burp image for user ${userId}...`);

    const startTime = Date.now();

    try {
      // Check if file exists
      const jarInfo = await this.getUploadedJAR(userId);
      if (!jarInfo) {
        throw new Error('No Burp Suite file uploaded for this user');
      }

      // Generate image name and tag
      const imageTag = `user-${userId}-${Date.now()}`;
      const fullImageName = `${this.baseImageName}:${imageTag}`;

      // Create build directory
      const buildDir = path.join(this.imageDir, userId, imageTag);
      await fs.mkdir(buildDir, { recursive: true });

      // Generate Dockerfile based on upload type
      const isInstaller = jarInfo.uploadType === 'installer';
      const dockerfile = isInstaller
        ? this.generateInstallerDockerfile()
        : this.generateBurpDockerfile();
      await fs.writeFile(path.join(buildDir, 'Dockerfile'), dockerfile);

      // Copy uploaded file to build directory
      const buildFileName = isInstaller
        ? 'burpsuite_pro_installer.sh'
        : 'burpsuite_pro.jar';
      await fs.copyFile(jarInfo.jarFilePath, path.join(buildDir, buildFileName));
      if (isInstaller) {
        await fs.chmod(path.join(buildDir, buildFileName), 0o755);
      }

      // Copy startup script
      const startupScript = isInstaller
        ? this.generateInstallerStartupScript()
        : this.generateBurpStartupScript();
      await fs.writeFile(path.join(buildDir, 'custom_startup.sh'), startupScript);
      await fs.chmod(path.join(buildDir, 'custom_startup.sh'), 0o755);

      // Build Docker image
      console.log(`[Burp Builder] Building image ${fullImageName} (${isInstaller ? 'installer' : 'JAR'} mode)...`);
      const buildCmd = `docker build -t ${fullImageName} ${buildDir}`;

      const { stdout, stderr } = await execAsync(buildCmd, {
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });

      const buildDuration = Date.now() - startTime;

      console.log(`[Burp Builder] Image built successfully in ${buildDuration}ms`);

      return {
        success: true,
        imageName: this.baseImageName,
        imageTag,
        buildDuration,
        buildLog: stdout + '\n' + stderr,
      };
    } catch (error) {
      const buildDuration = Date.now() - startTime;

      console.error(`[Burp Builder] Image build failed:`, error);

      return {
        success: false,
        imageName: this.baseImageName,
        imageTag: '',
        buildDuration,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Generate Burp Suite Dockerfile
   */
  private generateBurpDockerfile(): string {
    return `# Kasm Burp Suite Workspace Image
# Dynamically generated for user-uploaded JAR

FROM kasmweb/core-ubuntu-jammy:1.17.0
USER root

ENV HOME /home/kasm-default-profile
ENV STARTUPDIR /dockerstartup
WORKDIR $HOME

######### Burp Suite Installation ###########

# Install Java (required for Burp Suite)
RUN apt-get update && apt-get install -y \\
    openjdk-17-jre \\
    openjdk-17-jdk \\
    wget \\
    curl \\
    git \\
    python3 \\
    python3-pip \\
    && rm -rf /var/lib/apt/lists/*

# Copy user's Burp Suite JAR
COPY burpsuite_pro.jar /opt/burp/burpsuite_pro.jar
RUN chmod +x /opt/burp/burpsuite_pro.jar

# Install Burp extensions dependencies
RUN pip3 install --no-cache-dir \\
    beautifulsoup4 \\
    requests

# Create workspace directories
RUN mkdir -p /home/kasm-user/{workspace,burp-projects,extensions} \\
    && chown -R 1000:1000 /home/kasm-user

# Set up Burp desktop shortcut
RUN mkdir -p $HOME/Desktop \\
    && echo "[Desktop Entry]" > $HOME/Desktop/burp.desktop \\
    && echo "Type=Application" >> $HOME/Desktop/burp.desktop \\
    && echo "Name=Burp Suite" >> $HOME/Desktop/burp.desktop \\
    && echo "Exec=java -jar /opt/burp/burpsuite_pro.jar" >> $HOME/Desktop/burp.desktop \\
    && echo "Icon=/usr/share/pixmaps/burp.png" >> $HOME/Desktop/burp.desktop \\
    && chmod +x $HOME/Desktop/burp.desktop

# Copy custom startup script
COPY custom_startup.sh $STARTUPDIR/custom_startup.sh
RUN chmod +x $STARTUPDIR/custom_startup.sh

######### End Burp Configuration ###########

RUN chown 1000:0 $HOME
RUN $STARTUPDIR/set_user_permission.sh $HOME

ENV HOME /home/kasm-user
WORKDIR $HOME
RUN mkdir -p $HOME && chown -R 1000:0 $HOME

USER 1000
`;
  }

  /**
   * Generate Burp startup script
   */
  private generateBurpStartupScript(): string {
    return `#!/bin/bash
#
# Burp Suite Workspace Startup Script
#

set -e

echo "Starting Burp Suite workspace..."

# Wait for desktop environment
sleep 3

# Display welcome message
echo "==========================================" > /home/kasm-user/WELCOME.txt
echo "  Burp Suite Professional Workspace" >> /home/kasm-user/WELCOME.txt
echo "==========================================" >> /home/kasm-user/WELCOME.txt
echo "" >> /home/kasm-user/WELCOME.txt
echo "To launch Burp Suite:" >> /home/kasm-user/WELCOME.txt
echo "  - Double-click 'Burp Suite' on desktop" >> /home/kasm-user/WELCOME.txt
echo "  OR" >> /home/kasm-user/WELCOME.txt
echo "  - Run: java -jar /opt/burp/burpsuite_pro.jar" >> /home/kasm-user/WELCOME.txt
echo "" >> /home/kasm-user/WELCOME.txt
echo "Directories:" >> /home/kasm-user/WELCOME.txt
echo "  - /home/kasm-user/workspace - Working directory" >> /home/kasm-user/WELCOME.txt
echo "  - /home/kasm-user/burp-projects - Save Burp projects here" >> /home/kasm-user/WELCOME.txt
echo "  - /home/kasm-user/extensions - Custom Burp extensions" >> /home/kasm-user/WELCOME.txt
echo "" >> /home/kasm-user/WELCOME.txt

cat /home/kasm-user/WELCOME.txt

echo "Burp Suite workspace ready!"
`;
  }

  /**
   * Generate Dockerfile using the .sh installer (bundles correct JRE for arch)
   */
  private generateInstallerDockerfile(): string {
    return `# Kasm Burp Suite Pro Workspace — .sh Installer
# Dynamically generated — uses official installer for proper JRE + native GUI

FROM kasmweb/core-ubuntu-jammy:1.17.0
USER root

ENV HOME /home/kasm-default-profile
ENV STARTUPDIR /dockerstartup
ENV DEBIAN_FRONTEND noninteractive
WORKDIR $HOME

######### Dependencies ###########

RUN apt-get update && apt-get install -y --no-install-recommends \\
    libgtk-3-0 \\
    libxrender1 \\
    libxtst6 \\
    libxi6 \\
    libxrandr2 \\
    libxcomposite1 \\
    libxcursor1 \\
    libxdamage1 \\
    libxfixes3 \\
    libatk1.0-0 \\
    libatk-bridge2.0-0 \\
    libcups2 \\
    libdrm2 \\
    libgbm1 \\
    libpango-1.0-0 \\
    libcairo2 \\
    libasound2 \\
    libnspr4 \\
    libnss3 \\
    fonts-liberation \\
    xdg-utils \\
    curl \\
    wget \\
    git \\
    python3 \\
    python3-pip \\
    && apt-get clean \\
    && rm -rf /var/lib/apt/lists/*

RUN pip3 install --no-cache-dir \\
    requests \\
    beautifulsoup4 \\
    pyjwt

######### BurpSuite Installation ###########

COPY burpsuite_pro_installer.sh /tmp/burpsuite_installer.sh
RUN chmod +x /tmp/burpsuite_installer.sh \\
    && /tmp/burpsuite_installer.sh -q -dir /opt/BurpSuitePro \\
    && rm /tmp/burpsuite_installer.sh

# Create workspace directories
RUN mkdir -p /home/kasm-user/{workspace,burp-projects,extensions,burp-config} \\
    && chown -R 1000:1000 /home/kasm-user

######### Desktop Integration ###########

RUN mkdir -p $HOME/Desktop \\
    && printf '[Desktop Entry]\\nType=Application\\nName=BurpSuite Pro\\nComment=Web Security Testing\\nExec=/opt/BurpSuitePro/BurpSuitePro --project-dir=/home/kasm-user/burp-projects\\nTerminal=false\\nCategories=Security;Network;\\n' > $HOME/Desktop/burpsuite.desktop \\
    && chmod +x $HOME/Desktop/burpsuite.desktop

COPY custom_startup.sh $STARTUPDIR/custom_startup.sh
RUN chmod +x $STARTUPDIR/custom_startup.sh

######### Permissions ###########

RUN chown 1000:0 $HOME
RUN $STARTUPDIR/set_user_permission.sh $HOME

ENV HOME /home/kasm-user
WORKDIR $HOME
RUN mkdir -p $HOME && chown -R 1000:0 $HOME

USER 1000
`;
  }

  /**
   * Generate startup script for installer-based workspace
   */
  private generateInstallerStartupScript(): string {
    return `#!/bin/bash
set -e

echo "[BurpSuite Workspace] Starting..."
sleep 2

# Install license if mounted
if [ -f /opt/burp-setup/burpsuite.license ]; then
    mkdir -p /home/kasm-user/.BurpSuite
    cp /opt/burp-setup/burpsuite.license /home/kasm-user/.BurpSuite/burpsuite.license
    echo "[BurpSuite Workspace] License file installed"
fi

# Auto-launch if requested
if [ "\${BURP_AUTOSTART:-false}" = "true" ]; then
    /opt/BurpSuitePro/BurpSuitePro --project-dir=/home/kasm-user/burp-projects &
fi

echo "[BurpSuite Workspace] Ready"
echo "  Launch: Double-click 'BurpSuite Pro' on desktop"
echo "  Projects: /home/kasm-user/burp-projects"
`;
  }

  // ============================================================================
  // Image Management
  // ============================================================================

  /**
   * List Burp images for user
   */
  async listUserBurpImages(userId: string): Promise<BurpImage[]> {
    try {
      const listCmd = `docker images ${this.baseImageName} --filter "label=user=${userId}" --format "{{.Repository}}:{{.Tag}}"`;
      const { stdout } = await execAsync(listCmd);

      const images: BurpImage[] = [];
      const imageList = stdout.trim().split('\n').filter(Boolean);

      for (const imageFullName of imageList) {
        const [imageName, imageTag] = imageFullName.split(':');

        // Get image size
        const sizeCmd = `docker images ${imageFullName} --format "{{.Size}}"`;
        const { stdout: sizeOutput } = await execAsync(sizeCmd);

        images.push({
          userId,
          imageName,
          imageTag,
          jarFileName: 'burpsuite_pro.jar',
          createdAt: new Date(), // Could parse from docker inspect
          imageSize: sizeOutput.trim(),
        });
      }

      return images;
    } catch (error) {
      console.error('[Burp Builder] Failed to list images:', error);
      return [];
    }
  }

  /**
   * Delete Burp image
   */
  async deleteBurpImage(imageName: string, imageTag: string): Promise<void> {
    console.log(`[Burp Builder] Deleting image ${imageName}:${imageTag}...`);

    try {
      const deleteCmd = `docker rmi ${imageName}:${imageTag}`;
      await execAsync(deleteCmd);

      console.log(`[Burp Builder] Image deleted`);
    } catch (error) {
      console.error(`[Burp Builder] Image deletion failed:`, error);
      throw error;
    }
  }

  /**
   * Get Burp image info
   */
  async getBurpImageInfo(imageName: string, imageTag: string): Promise<BurpImage | null> {
    try {
      const inspectCmd = `docker inspect ${imageName}:${imageTag}`;
      const { stdout } = await execAsync(inspectCmd);

      const imageInfo = JSON.parse(stdout)[0];

      return {
        userId: imageInfo.Config.Labels?.user || 'unknown',
        imageName,
        imageTag,
        jarFileName: 'burpsuite_pro.jar',
        createdAt: new Date(imageInfo.Created),
        imageSize: `${(imageInfo.Size / 1024 / 1024 / 1024).toFixed(2)} GB`,
      };
    } catch (error) {
      console.error('[Burp Builder] Failed to get image info:', error);
      return null;
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const burpImageBuilder = new BurpImageBuilder();
