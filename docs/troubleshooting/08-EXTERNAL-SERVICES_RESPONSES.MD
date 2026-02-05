Please retain the context that, ultimately, `rtpi/` will be the only codebase on this device. Once the app is fully operational, all obsolete artifacts will be deleted. 

Additionally, these services need to be able to operational by January 1, meaning they must be completed along-side the current timeline for Beta Test Ready

For any answer that requires more clarity, please ask for further clarification and what it is you'd like clarified. 

- __Question:__ Should Empire have its own dedicated database or share RTPI's postgres with schema separation?

  - __Answer:__ Share RTPI's postgres with schema separation

- __Question:__ How do we handle Empire's internal auth when users are already authenticated via Cloudflare?

  - __Answer:__ - Option 2: Use a single "service account" token from RTPI

- __Question:__ Should Empire listeners use dynamic port allocation or fixed ranges?

  - __Answer:__ Treat Kasm nginx as aredirector

  __D. Memory Requirements__

- __Question:__ Implement model auto-unloading or keep loaded?

__C. Model Storage__
- __Question:__ Which models should be pre-downloaded?


__B. Docker GPU Passthrough__
- __Question:__ Should Ollama be optional or required?
  - __Answer:__ optional
__A. NVIDIA Driver Requirements__

- __Question:__ What if the host system doesn't have NVIDIA GPU?
  - __Answer:__ Incorporate llama.cpp installation
  - __Tavily Toosl:__ https://github.com/ggml-org/llama.cpp
### 4. __Cloudflare Access + Authentication Integration__

#### Friction Points:

__A. JWT Verification Overhead__

- __Question:__ How often should we refresh Cloudflare's public keys?
- __Performance Concern:__ JWT verification adds 5-20ms per request
  - __Answer:__  I have yet to incorporate JWT, this would be its own implementation, ignore this for now.

__B. User Sync from Google Workspace__

- Need to sync user data from Google Workspace to RTPI on first login

- Google Workspace groups need to map to RTPI roles

- __Question:__ How do we map Google Workspace groups to RTPI roles?

  - `rtpi-admins@attck.nexus` → role: admin
  - `rtpi-operators@attck.nexus` → role: operator
  - `rtpi-viewers@attck.nexus` → role: viewer
  - __Answer:__ These roles are fine for now

__C. Service-to-Service Authentication__

- RTPI needs to call Empire, SysReptor, Kasm APIs
- These services don't understand Cloudflare Access
- __Question:__ Use service account tokens or implement API gateway?
  - __Answer:__ Utilize the RTPI API Gateway

__D. Session Management__

- Cloudflare Access manages sessions externally
- RTPI also has its own session system
- __Question:__ Rely entirely on Cloudflare Access or maintain dual sessions?
- __Risk:__ Session desync between Cloudflare and RTPI
  - __Answer:__ Create logic for local session management unless a production deployment, if production deployment rely entirely on Cloudflare Access 

__E. Logout Flow__

- Logging out of RTPI doesn't log out of Cloudflare Access
- __Question:__ Implement custom logout that clears both?
  - __Answer:__ yes 

(For now Sysreptor technical writer plugin will be part of Version 2.5, ignore this section)
### 3. __SysReptor Technical Writer Agent Plugin__ 

#### Friction Points:

__A. Content Format Transformation__

- RTPI agents output in various formats (JSON, markdown, plain text)
- SysReptor expects specific markdown structure with frontmatter
- __Question:__ Do we need a universal content transformer or format-specific handlers?

__B. Bi-Directional Sync Conflicts__

- User edits report in SysReptor while agent is generating content

- __Question:__ How do we handle concurrent edits?

  - Option 1: Lock sections during agent generation
  - Option 2: Implement conflict resolution (git-style merges)
  - Option 3: Agent only writes to "draft" sections, user must approve

__C. Report Template Compatibility__

- SysReptor templates may not match RTPI's vulnerability structure
- __Question:__ Do we need to create custom SysReptor templates that match RTPI's data model?

__D. API Rate Limiting__

- SysReptor API may have rate limits
- Technical Writer Agent could generate sections rapidly
- __Question:__ Implement throttling or batch updates?

__E. Section Ownership__

- Who "owns" each section - agent or human?
- __Question:__ Implement section locking or collaborative editing?
(End Sysreptor section for 2.5)

### 2. __Kasm Workspaces Full Containerization__

#### Friction Points:

__A. Complex Multi-Container Architecture__

- Kasm requires 10+ containers (db, redis, api, manager, proxy, guac, multiple workspaces)
- Container orchestration complexity increases significantly
- __Question:__ Should we use docker-compose or move to Kubernetes for better orchestration?
  - __Follow-up:__ Please describe the benefit and technical overhaul fo using kubernetes

__B. Certificate Management__

- Kasm proxy needs SSL certificates for HTTPS

- Certificates must be trusted by browsers

- __Question:__

  - Use Let's Encrypt with automated renewal?
  - Use Cloudflare-managed certificates?
  - Self-signed certificates for internal use?

- __Concern:__ Certificate rotation without service interruption
  - __Answer:__    
      - Use Let's Encrypt with automated renewal
      - Use Cloudflare-managed certificates

__C. Workspace Image Build Process__

- Custom workspaces (Burp Suite, Empire client) need to be built
- Burp Suite requires uploaded JAR file (licensing concern)
- Image builds can take 10-30 minutes each
- __Question:__ Should we pre-build images or build on-demand?
  - __Answer__ pre-build everything except burpsuite, that will be built when the jar and license.txt are uploaded

<Please incorporate Persistent Workspace Data into the 2.1 enhancements.>

__D. Persistent Workspace Data__

- Users may want workspace sessions to persist across restarts
- VS Code extensions, Burp configurations, etc.
- __Question:__ Implement user-specific persistent volumes?
- __Storage Concern:__ Each persistent workspace could be 1-5GB
  - __Answer__ Each production instance will have access to a Google Storage Bucket.  

<Please incorporate Persistent Workspace Data into the 2.1 enhancements.>

__E. Network Isolation__

- Workspaces need network access for testing, but must be isolated from each other
- __Question:__ Create separate Docker networks per operation or use Kasm's built-in isolation?

  - __Answer:__ Use Kasms built-in Isolation

####

### 1. __Empire C2 Docker Integration__

#### Friction Points:

__A. Database Schema Migration__

- Empire has its own PostgreSQL schema that may conflict with RTPI's
- Need separate database or careful schema namespacing
- __Question:__ Should Empire have its own dedicated database or share RTPI's postgres with schema separation?
  - __Answer:__ Share RTPI with schema separation 

__B. API Authentication__

- Empire uses its own auth system (username/password + API tokens)

- Need to bridge Empire's auth with Cloudflare Access

- __Question:__ How do we handle Empire's internal auth when users are already authenticated via Cloudflare?

  - __Answer:__  Option 1: Create Empire API tokens per RTPI user automatically

__C. Empire Agent Persistence__

- Empire agents are ephemeral - if container restarts, active sessions may be lost
- __Question:__ Do we need to implement Empire agent state backup/restoration?
- __Answer:__ Use Docker volumes for Empire data directory + implement reconnection logic

__D. Listener Port Management__

- __Question:__ Should Empire listeners use dynamic port allocation or fixed ranges?
- __Concern:__ Kasm nginx proxy might conflict with Empire listener ports
  
  - __Answer:__ create dynamic reverse proxy logic to automatically route Empire listeners through kasm nginx proxy for new listening ports 
