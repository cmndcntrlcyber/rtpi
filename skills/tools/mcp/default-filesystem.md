---
name: MCP Filesystem
description: MCP server exposing local filesystem read/write operations to AI
  agents within explicitly allowed directories via stdio transport.
registry: mcp
tool_id: default:filesystem
category: mcp-server
tags:
  - mcp-server
  - filesystem
  - file-operations
  - stdio
  - sandbox
  - local-access
  - read-write
summary: The MCP Filesystem server grants AI agents controlled read/write access
  to local files and directories via the Model Context Protocol. It is invoked
  with `npx -y @modelcontextprotocol/server-filesystem <allowed_dir_paths>` and
  enforces strict path validation—all operations are restricted to explicitly
  allowed directories passed as arguments. Use when agents need to read source
  code, write reports, manage configuration files, or perform batch file
  operations in /home/cmndcntrl/code/rtpi/mcp-workspace. The server provides
  tools including read_file, write_file, read_multiple_files, edit_file
  (pattern-based selective edits), create_directory, move_file, list_directory,
  search_files (recursive pattern matching), get_file_info, and directory_tree.
  All paths are validated against allowed directories; symlinks pointing outside
  trigger warnings; path traversal attempts are blocked. Outputs are returned as
  MCP tool responses with text content for file contents, JSON structures for
  directory listings, and metadata objects for file info. Do NOT attempt
  operations outside the configured workspace—they will be rejected. This is a
  stdio transport server with no network capability. Primarily useful for
  headless automation, batch processing, or accessing files outside the agent
  host's working directory.
sources:
  - https://docs.stacklok.com/toolhive/guides-mcp/filesystem
  - https://skyvia.com/blog/filesystem-mcp-server
  - https://dev.to/furudo_erika_7633eee4afa5/how-to-use-local-filesystem-mcp-server-363e
  - https://www.pulsemcp.com/servers/modelcontextprotocol-filesystem
  - https://github.com/mark3labs/mcp-filesystem-server
  - https://docs.rs/crate/mcp-server-filesystem/latest
  - https://www.philschmid.de/mcp-cli
  - https://www.librechat.ai/docs/configuration/librechat_yaml/object_structure/mcp_servers
  - https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem
  - https://lobehub.com/mcp/marcusjellinghaus-mcp-server-filesystem
  - https://mcp.so/server/mcp-filesystem/gabrielmaialva33
  - https://mcp.so/server/mcp_server_filesystem/philgei
generated_at: 2026-09-04T02:29:55.986Z
generated_by: anthropic
source_hash: 4447056b5ddd4003e289d5da271f76a7f5b13c44e6dd9e2dcfe5d1864552469c
---

# MCP Filesystem

## Overview

MCP Filesystem is an official Model Context Protocol server implementation (NPM package @modelcontextprotocol/server-filesystem) that exposes local filesystem operations to AI agents via stdio transport. It acts as a secure bridge allowing controlled file read, write, search, and directory management within predefined allowed directories. Security is enforced through path validation, prevention of directory traversal attacks (../ blocked), and symlink resolution with boundary checks. The server is stateless and operates synchronously over stdio, making it suitable for automation pipelines and headless environments. This RTPI instance is configured with workspace /home/cmndcntrl/code/rtpi/mcp-workspace as the single allowed root.

## When to use

Use MCP Filesystem when agents need to: (1) Read source code, configuration files, logs, or data files for analysis or vulnerability scanning. (2) Write reports, generated code, extraction results, or modified configurations back to disk. (3) Perform batch operations like reading multiple files, searching codebases for patterns (e.g., secrets, vulnerabilities), or generating directory trees. (4) Manage project structure by creating directories, moving/renaming files, or organizing output. (5) Access files outside the agent host application's native working directory. Do NOT use for network file systems, cloud storage, or operations requiring privilege escalation—this server only accesses local paths within the configured workspace and has no network transport.

## Authentication & setup

No authentication mechanism exists—security is enforced by limiting allowed directories at launch. The server is invoked via `npx -y @modelcontextprotocol/server-filesystem <allowed_directory_paths>`. This RTPI deployment launches with `/home/cmndcntrl/code/rtpi/mcp-workspace` as the single allowed directory. All file operations are restricted to this path and its subdirectories. The server communicates over stdio (standard input/output) and is automatically managed by the MCP infrastructure—agents do not manually start or stop it. No configuration file is used in this deployment; allowed directories are specified solely via command-line arguments. If the server is not responding, check that the workspace directory exists and is readable. Path validation failures will return error messages indicating the operation was blocked.

## Key commands / parameters

Available tools (invoked via MCP tool call protocol):

**read_file** / **read_text_file**: Read complete file contents. Parameters: `path` (required, string). Returns text content or error if outside allowed directories.

**read_multiple_files**: Read multiple files in one operation. Parameters: `paths` (required, array of strings). Returns array of file contents.

**write_file**: Create new file or overwrite existing. Parameters: `path` (required), `content` (required, string). Creates parent directories if needed.

**edit_file** / **modify_file**: Selective edits using pattern matching and replacement. Parameters: `path` (required), pattern/replacement directives. Safer than full overwrites for incremental changes.

**create_directory**: Create directory or ensure it exists. Parameters: `path` (required). Idempotent operation.

**move_file**: Move or rename files/directories. Parameters: `source` (required), `destination` (required). Both paths must be within allowed directories.

**list_directory**: List directory contents showing files and subdirectories. Parameters: `path` (required). Returns array of entries with names and types.

**list_directory_with_sizes**: Enhanced directory listing with file sizes. Parameters: `path` (required).

**search_files**: Recursive pattern-based file search. Parameters: `path` (directory to search), `pattern` (glob or regex pattern). Returns matching file paths.

**get_file_info**: Retrieve file metadata (size, timestamps, permissions, MIME type). Parameters: `path` (required).

**directory_tree**: Generate hierarchical directory structure. Parameters: `path` (required). Returns tree representation.

**delete_file**: Delete file or directory. Parameters: `path` (required), `recursive` (optional boolean, default false). Use with caution.

**copy_file**: Copy files or directories. Parameters: `source`, `destination`. Both must be within allowed boundaries.

**read_media_file**: Read binary/media files with base64 encoding for inline content. Parameters: `path` (required).

## Example workflows

**Codebase vulnerability scan**: (1) Use `directory_tree` on /home/cmndcntrl/code/rtpi/mcp-workspace to understand structure. (2) Use `search_files` with pattern '*.py' or '*.js' to locate source files. (3) Use `read_multiple_files` to batch-read discovered files. (4) Analyze for vulnerabilities (hardcoded secrets, SQL injection patterns). (5) Use `write_file` to create a report at /home/cmndcntrl/code/rtpi/mcp-workspace/scan_report.txt.

**Configuration file modification**: (1) Use `read_file` to read existing config at /home/cmndcntrl/code/rtpi/mcp-workspace/config.yaml. (2) Parse and modify in agent logic. (3) Use `write_file` to atomically replace the config file. Alternatively, use `edit_file` for surgical pattern-based changes.

**Log aggregation**: (1) Use `search_files` with pattern '*.log' under /home/cmndcntrl/code/rtpi/mcp-workspace/logs. (2) Use `read_multiple_files` to retrieve all logs. (3) Parse and aggregate findings. (4) Use `write_file` to create summary report.

**Directory organization**: (1) Use `create_directory` to establish /home/cmndcntrl/code/rtpi/mcp-workspace/results. (2) Use `move_file` to relocate analysis outputs into organized subdirectories. (3) Use `get_file_info` to verify file sizes and timestamps.

**Secret extraction**: (1) Use `search_files` with pattern matching common secret files (.env, credentials.json). (2) Use `read_file` on matches. (3) Parse and extract credentials. (4) Use `write_file` to create loot inventory.

## Output format

All tools return MCP-formatted responses with a `content` field. **Text files**: Content returned as plain string in `content.text`. **Directory listings**: JSON array of objects with `name`, `type` (file/directory), optionally `size`. **File metadata**: JSON object with fields `size` (bytes), `created`, `modified`, `accessed` (ISO timestamps), `isDirectory`, `isFile`, `permissions`, `mimeType`. **Search results**: Array of file path strings matching the pattern. **Binary/media files**: base64-encoded content in `content.text` or external reference if size exceeds limits. **Errors**: Error message strings indicating path validation failure, file not found, permission denied, or operation not allowed. The server enforces size limits for inline content (typically 10MB for text, smaller thresholds for base64). Larger files may return truncated content or error messages.

## Common pitfalls

**Path traversal attempts**: Any path containing `..` or attempting to escape /home/cmndcntrl/code/rtpi/mcp-workspace will be rejected with an error. Always use absolute paths within the workspace or relative paths that resolve inside it. **Symlink warnings**: If a symlink points outside allowed directories, operations may fail or trigger security warnings. Test symlink resolution with `get_file_info` first. **Overwriting files**: `write_file` will silently overwrite existing files without confirmation. Use `read_file` first to verify contents if preservation matters, or use `edit_file` for selective changes. **Large file operations**: Reading multi-gigabyte files may timeout or exceed memory limits. Use `get_file_info` to check file size before reading. **Recursive deletes**: `delete_file` with `recursive: true` will permanently remove entire directory trees. Double-check paths before invoking. **Permission errors**: The server runs with the permissions of the user invoking npx (typically the RTPI operator). Files requiring elevated privileges cannot be accessed. **MIME type limitations**: Binary file detection relies on file extensions and magic bytes; edge cases may misclassify files. **No undo**: All write, delete, and move operations are immediate and irreversible. Implement external backups or versioning if critical data is at risk. **Case sensitivity**: Filesystem path matching is case-sensitive on Linux; /home/cmndcntrl is NOT the same as /Home/CMNDcntrl.

## References

• https://docs.stacklok.com/toolhive/guides-mcp/filesystem
• https://dev.to/furudo_erika_7633eee4afa5/how-to-use-local-filesystem-mcp-server-363e
• https://www.pulsemcp.com/servers/modelcontextprotocol-filesystem
• https://github.com/mark3labs/mcp-filesystem-server
• https://docs.rs/crate/mcp-server-filesystem/latest
• https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem
• https://www.librechat.ai/docs/configuration/librechat_yaml/object_structure/mcp_servers
• https://lobehub.com/mcp/marcusjellinghaus-mcp-server-filesystem
