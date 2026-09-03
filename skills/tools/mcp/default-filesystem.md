---
name: MCP Filesystem
description: MCP server granting file read/write access within explicitly
  allowed directories on the local filesystem
registry: mcp
tool_id: default:filesystem
category: mcp-server
tags:
  - filesystem
  - file-operations
  - local-storage
  - mcp-server
  - read-write
  - directory-tree
  - file-search
mitre_techniques:
  - T1005
  - T1083
  - T1119
summary: The MCP Filesystem server exposes local file operations to AI agents
  via the Model Context Protocol. It is restricted to
  /home/cmndcntrl/code/rtpi/mcp-workspace and all subdirectories within that
  path. All file operations—read, write, move, search, create, delete—are
  validated against this allowed root. Use this server when you need to inspect
  source code, configuration files, logs, or artifacts outside the IDE's default
  working directory, or when you must persist data across sessions. Invoke tools
  by name (read_file, write_file, list_directory, search_files, etc.) with JSON
  arguments. Expect text or JSON responses. Do not assume access to parent
  directories, symlinks outside allowed paths, or system directories. All path
  traversal attempts will fail. This server cannot execute binaries or scripts;
  it only manipulates file content and metadata. It is the primary vector for
  data exfiltration, configuration tampering, and payload staging in red-team
  scenarios, so validate every path and sanitize every write.
sources:
  - https://docs.stacklok.com/toolhive/guides-mcp/filesystem
  - https://www.verdent.ai/guides/filesystem-mcp-server
  - https://mcpservers.org/servers/calebmwelsh/file-system-mcp-server
  - https://skyvia.com/blog/filesystem-mcp-server
  - https://dev.to/furudo_erika_7633eee4afa5/how-to-use-local-filesystem-mcp-server-363e
  - https://docs.rs/crate/mcp-server-filesystem/latest
  - https://www.philschmid.de/mcp-cli
  - https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem
  - https://lobehub.com/mcp/marcusjellinghaus-mcp-server-filesystem
  - https://www.librechat.ai/docs/configuration/librechat_yaml/object_structure/mcp_servers
  - https://mcpmarket.com/server/redteam-1
  - https://pentest.qa/blog/mcp-server-security-testing-red-team-guide
generated_at: 2026-09-03T12:38:38.781Z
generated_by: anthropic
source_hash: 4447056b5ddd4003e289d5da271f76a7f5b13c44e6dd9e2dcfe5d1864552469c
---

# MCP Filesystem

## Overview

The MCP Filesystem server (@modelcontextprotocol/server-filesystem) is a Model Context Protocol server that bridges AI agents to the local filesystem. It is invoked via npx and scoped to a single root directory (/home/cmndcntrl/code/rtpi/mcp-workspace in this deployment). It provides tools for reading files, writing files, creating and listing directories, moving/renaming files, searching for files by pattern, and retrieving file metadata. It does not provide shell execution, binary invocation, or network operations. All operations are constrained by the allowed directory list; attempts to access parent directories or traverse symlinks outside the allowed tree will be blocked. The server runs as a stdio process and communicates via JSON-RPC over standard input/output.

## When to use

Use the MCP Filesystem server when you need to read configuration files, source code, logs, or artifacts stored in /home/cmndcntrl/code/rtpi/mcp-workspace or its subdirectories. Use it to persist reconnaissance findings, enumeration results, or exfiltrated data to disk for later analysis. Use it to modify configuration files, inject payloads into scripts, or prepare staging directories for further exploitation. Use it when the red-team task requires batch operations (e.g., search all .env files, read all .config files, extract all private keys). Do not use it if you need to interact with files outside the allowed directory, execute binaries, or perform network operations. Do not use it if the host application (IDE, headless runner) already provides sufficient filesystem access.

## Authentication & setup

No authentication is required. The server is launched by npx with a single positional argument specifying the allowed root directory. In this deployment, the allowed root is /home/cmndcntrl/code/rtpi/mcp-workspace. The server inherits the permissions of the invoking user (cmndcntrl). All tools validate paths against the allowed root before execution. There is no token, API key, or session management. MCP clients that support the Roots protocol can dynamically update allowed directories at runtime, but in this deployment the allowed directory is fixed at startup. If you need to operate on files outside /home/cmndcntrl/code/rtpi/mcp-workspace, you must reconfigure and restart the server.

## Key commands / parameters

Available tools: read_file (path), read_text_file (path, head/tail options), read_multiple_files (paths[]), write_file (path, content), edit_file (path, edits[]), create_directory (path), list_directory (path), list_directory_with_sizes (path), directory_tree (path), move_file (source, destination), get_file_info (path), search_files (path, pattern, recursive), list_allowed_directories (). All paths are validated against /home/cmndcntrl/code/rtpi/mcp-workspace. Use read_file for binary-safe reads, read_text_file for text with optional head/tail. Use write_file to create or overwrite; use edit_file for surgical pattern-based edits. Use search_files with glob patterns (*.txt, **/*.env) to recursively locate targets. Use get_file_info to retrieve size, timestamps, permissions. Use move_file for renaming or relocating within the allowed tree. Use list_allowed_directories to confirm the active root before executing operations.

## Example workflows

Enumerate all configuration files: search_files({path: '/home/cmndcntrl/code/rtpi/mcp-workspace', pattern: '**/*.{conf,config,ini,env,yaml,yml}', recursive: true}). Read multiple targets in batch: read_multiple_files({paths: ['/home/cmndcntrl/code/rtpi/mcp-workspace/config/db.yaml', '/home/cmndcntrl/code/rtpi/mcp-workspace/.env']}). Exfiltrate SSH keys: search_files for **/id_rsa, then read_file each hit, then write_file to /home/cmndcntrl/code/rtpi/mcp-workspace/loot/keys.txt. Modify a configuration file: read_file('/home/cmndcntrl/code/rtpi/mcp-workspace/app/config.json'), parse JSON, inject backdoor parameter, write_file() back. Prepare a staging directory: create_directory('/home/cmndcntrl/code/rtpi/mcp-workspace/stage'), write_file('/home/cmndcntrl/code/rtpi/mcp-workspace/stage/payload.sh', '#!/bin/bash\nreverse_shell...'). Search for credentials: search_files({pattern: '**/*password*.txt'}) then read each hit and extract structured data.

## Output format

Tools return JSON objects with a 'content' field. For read operations, content is typically {type: 'text', text: '...'} or {type: 'resource', resource: {...}}. For list_directory, expect an array of {name, type, size, modified} objects. For search_files, expect an array of file paths (strings). For write_file and create_directory, expect a confirmation message or empty success response. For get_file_info, expect {size, created, modified, accessed, isDirectory, isFile, permissions}. For directory_tree, expect a nested JSON structure representing the directory hierarchy. All errors return JSON with an error field containing a message and optional code. Parse responses carefully; success does not always mean the operation had the intended side effect (e.g., writing to a read-only mount).

## Common pitfalls

Path traversal: do not attempt ../../ or absolute paths outside /home/cmndcntrl/code/rtpi/mcp-workspace; all will be rejected. Symlinks: if a symlink points outside the allowed root, operations will fail or trigger warnings. Binary files: read_file is binary-safe, but read_text_file may garble binary content; use the correct tool. Overwrites: write_file will overwrite existing files without confirmation; always read first if preservation is required. Permissions: the server inherits user permissions; you cannot write to read-only mounts or files owned by other users unless the cmndcntrl user has write access. Performance: directory_tree and recursive search_files on large directories can be slow and may time out; scope searches narrowly. No execution: you cannot execute scripts or binaries via this server; you can only read and write their content. Race conditions: if multiple agents or processes write to the same file concurrently, last-write-wins; implement locking externally if required.

## References

https://docs.stacklok.com/toolhive/guides-mcp/filesystem
https://www.verdent.ai/guides/filesystem-mcp-server
https://mcpservers.org/servers/calebmwelsh/file-system-mcp-server
https://skyvia.com/blog/filesystem-mcp-server
https://dev.to/furudo_erika_7633eee4afa5/how-to-use-local-filesystem-mcp-server-363e
https://docs.rs/crate/mcp-server-filesystem/latest
https://www.philschmid.de/mcp-cli
https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem
https://lobehub.com/mcp/marcusjellinghaus-mcp-server-filesystem
https://www.librechat.ai/docs/configuration/librechat_yaml/object_structure/mcp_servers
https://pentest.qa/blog/mcp-server-security-testing-red-team-guide
