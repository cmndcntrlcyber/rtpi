import { Router, Request, Response, NextFunction } from "express";

const router = Router();

const REGISTRY_SCHEMA = {
  schema_version: "1.0",
  default_image_properties: {
    cores: 2,
    memory: 2768000000,
    gpu_count: 0,
    cpu_allocation_method: "Inherit",
    docker_registry: "https://index.docker.io/v1/",
    volume_mappings: {},
    run_config: {},
    exec_config: {},
    restrict_network_names: [],
  },
  images: [
    {
      friendly_name: "VS Code (Web)",
      description: "Visual Studio Code IDE in a browser-accessible workspace",
      name: "kasmweb/vs-code:1.16.0",
      image_src: "img/thumbnails/vs-code.png",
      categories: ["Development"],
      cores: 2,
      memory: 3072000000,
      docker_registry: "https://index.docker.io/v1/",
      image_type: "Container",
      enabled: true,
      require_gpu: false,
      persistent_profile_path: "/home/kasm-user",
    },
    {
      friendly_name: "Kali Linux Desktop",
      description: "Kali Linux rolling release with full desktop environment for penetration testing",
      name: "kasmweb/kali-rolling-desktop:1.16.0",
      image_src: "img/thumbnails/kali.png",
      categories: ["Security", "Desktop"],
      cores: 4,
      memory: 4096000000,
      docker_registry: "https://index.docker.io/v1/",
      image_type: "Container",
      enabled: true,
      require_gpu: false,
      persistent_profile_path: "/home/kasm-user",
    },
    {
      friendly_name: "Firefox Browser",
      description: "Firefox web browser in an isolated workspace",
      name: "kasmweb/firefox:1.16.0",
      image_src: "img/thumbnails/firefox.png",
      categories: ["Browser"],
      cores: 2,
      memory: 2768000000,
      docker_registry: "https://index.docker.io/v1/",
      image_type: "Container",
      enabled: true,
      require_gpu: false,
    },
    {
      friendly_name: "Chromium Browser",
      description: "Chromium web browser in an isolated workspace",
      name: "kasmweb/chromium:1.16.0",
      image_src: "img/thumbnails/chromium.png",
      categories: ["Browser"],
      cores: 2,
      memory: 2768000000,
      docker_registry: "https://index.docker.io/v1/",
      image_type: "Container",
      enabled: true,
      require_gpu: false,
    },
    {
      friendly_name: "Ubuntu Jammy Desktop",
      description: "Ubuntu 22.04 LTS desktop environment",
      name: "kasmweb/ubuntu-jammy-desktop:1.16.0",
      image_src: "img/thumbnails/ubuntu.png",
      categories: ["Desktop"],
      cores: 2,
      memory: 2768000000,
      docker_registry: "https://index.docker.io/v1/",
      image_type: "Container",
      enabled: true,
      require_gpu: false,
      persistent_profile_path: "/home/kasm-user",
    },
    {
      friendly_name: "Terminal (Ubuntu)",
      description: "Terminal-only Ubuntu workspace for CLI workflows",
      name: "kasmweb/terminal:1.16.0",
      image_src: "img/thumbnails/terminal.png",
      categories: ["Development"],
      cores: 1,
      memory: 1024000000,
      docker_registry: "https://index.docker.io/v1/",
      image_type: "Container",
      enabled: true,
      require_gpu: false,
    },
  ],
};

router.get("/", (_req: Request, res: Response) => {
  res.json(REGISTRY_SCHEMA);
});

/**
 * Hostname-based middleware: when the request arrives on the registry
 * subdomain (via Cloudflare Tunnel), serve the schema at the root path.
 * Mount this BEFORE the SPA catch-all in server/index.ts.
 */
export function registryHostnameMiddleware(registryHostname: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.hostname === registryHostname || req.headers.host?.startsWith(registryHostname)) {
      return res.json(REGISTRY_SCHEMA);
    }
    next();
  };
}

export default router;
