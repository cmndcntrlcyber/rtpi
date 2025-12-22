# Custom Security Tools

This directory is for custom security tools and scripts that will be copied into the `rtpi-tools` Docker container.

## Purpose

Any tools, scripts, or utilities placed in this directory will be available in the rtpi-tools container at `/opt/tools/custom/`.

## Usage

1. Add your custom tools/scripts to this directory
2. Rebuild the rtpi-tools container: `docker compose build rtpi-tools`
3. Access tools inside the container: `docker exec -it rtpi-tools bash`
4. Tools will be available at `/opt/tools/custom/`

## Examples

You can add:
- Custom PowerShell scripts
- Python exploitation scripts
- Shell scripts for automation
- Configuration files for existing tools
- Custom binaries

## Note

This directory is optional. If empty, the container will still build successfully with all pre-installed tools available.
