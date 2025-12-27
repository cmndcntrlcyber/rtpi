# Kasm VS Code Workspace Image
# Phase 3: Workspace Images (#KW-16)
#
# This image provides a full VS Code development environment
# accessible through browser via Kasm Workspaces.
#
# Build: docker build -t rtpi/kasm-vscode:latest ./kasm-images/vscode
# Run: Via Kasm Workspaces API

FROM kasmweb/core-ubuntu-focal:1.17.0
USER root

ENV HOME /home/kasm-default-profile
ENV STARTUPDIR /dockerstartup
ENV INST_SCRIPTS $STARTUPDIR/install
WORKDIR $HOME

######### Customize Container Here ###########

# Install VS Code dependencies
RUN apt-get update && apt-get install -y \
    wget \
    gpg \
    apt-transport-https \
    software-properties-common \
    git \
    curl \
    build-essential \
    python3 \
    python3-pip \
    nodejs \
    npm \
    && rm -rf /var/lib/apt/lists/*

# Install Visual Studio Code
RUN wget -qO- https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > /usr/share/keyrings/packages.microsoft.gpg \
    && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/packages.microsoft.gpg] https://packages.microsoft.com/repos/code stable main" \
    > /etc/apt/sources.list.d/vscode.list \
    && apt-get update \
    && apt-get install -y code \
    && rm -rf /var/lib/apt/lists/*

# Install common VS Code extensions
RUN code --install-extension ms-python.python \
    --install-extension ms-vscode.cpptools \
    --install-extension dbaeumer.vscode-eslint \
    --install-extension esbenp.prettier-vscode \
    --install-extension eamodio.gitlens \
    --install-extension GitHub.copilot \
    --install-extension ms-azuretools.vscode-docker \
    --install-extension redhat.vscode-yaml \
    --install-extension ms-vscode.vscode-typescript-next \
    --user-data-dir /home/kasm-default-profile/.vscode \
    || true  # Don't fail if some extensions can't install

# Install security tools for development
RUN pip3 install --no-cache-dir \
    bandit \
    safety \
    pylint \
    black \
    flake8

# Install common programming languages and tools
RUN apt-get update && apt-get install -y \
    golang-go \
    default-jdk \
    ruby \
    php \
    docker.io \
    && rm -rf /var/lib/apt/lists/*

# Configure Git
RUN git config --system user.name "RTPI User" \
    && git config --system user.email "user@rtpi.local" \
    && git config --system init.defaultBranch main

# Create workspace directory
RUN mkdir -p /home/kasm-user/workspace \
    && chown -R 1000:1000 /home/kasm-user

# Set up desktop icon for VS Code
RUN mkdir -p $HOME/Desktop \
    && echo "[Desktop Entry]" > $HOME/Desktop/vscode.desktop \
    && echo "Type=Application" >> $HOME/Desktop/vscode.desktop \
    && echo "Name=VS Code" >> $HOME/Desktop/vscode.desktop \
    && echo "Exec=/usr/share/code/code --no-sandbox --user-data-dir=/home/kasm-user/.vscode" >> $HOME/Desktop/vscode.desktop \
    && echo "Icon=/usr/share/pixmaps/vscode.png" >> $HOME/Desktop/vscode.desktop \
    && echo "Categories=Development;IDE;" >> $HOME/Desktop/vscode.desktop \
    && chmod +x $HOME/Desktop/vscode.desktop

# Copy custom startup script (auto-start VS Code)
COPY custom_startup.sh $STARTUPDIR/custom_startup.sh
RUN chmod +x $STARTUPDIR/custom_startup.sh

######### End Customizations ###########

RUN chown 1000:0 $HOME
RUN $STARTUPDIR/set_user_permission.sh $HOME

ENV HOME /home/kasm-user
WORKDIR $HOME
RUN mkdir -p $HOME && chown -R 1000:0 $HOME

USER 1000
