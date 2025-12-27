# Kasm Kali Linux Workspace Image
# Phase 3: Workspace Images (#KW-17)
#
# This image provides a Kali Linux pentesting environment
# with common security tools accessible through browser.
#
# Build: docker build -t rtpi/kasm-kali:latest ./kasm-images/kali
# Run: Via Kasm Workspaces API

FROM kasmweb/core-kali-rolling:1.17.0
USER root

ENV HOME /home/kasm-default-profile
ENV STARTUPDIR /dockerstartup
WORKDIR $HOME

######### Customize Container Here ###########

# Update package lists
RUN apt-get update

# Install Kali metapackages for penetration testing
RUN apt-get install -y \
    kali-tools-top10 \
    kali-tools-web \
    kali-tools-passwords \
    kali-tools-exploitation \
    kali-tools-information-gathering \
    && rm -rf /var/lib/apt/lists/*

# Install additional essential tools not in metapackages
RUN apt-get update && apt-get install -y \
    # Network tools
    wireshark \
    tcpdump \
    netcat-traditional \
    socat \
    proxychains4 \
    tor \
    # Web application testing
    zaproxy \
    wfuzz \
    ffuf \
    commix \
    # Password attacks
    hydra \
    john \
    hashcat \
    crunch \
    # Exploitation frameworks
    metasploit-framework \
    # Post-exploitation
    mimikatz \
    powershell \
    # Reverse engineering
    radare2 \
    ghidra \
    # Programming and scripting
    python3-pip \
    golang-go \
    ruby \
    php \
    # Database clients
    mysql-client \
    postgresql-client \
    redis-tools \
    mongodb-clients \
    # Cloud tools
    awscli \
    # Utilities
    git \
    curl \
    wget \
    vim \
    tmux \
    screen \
    jq \
    && rm -rf /var/lib/apt/lists/*

# Install Python security tools
RUN pip3 install --no-cache-dir \
    impacket \
    pwntools \
    scapy \
    requests \
    beautifulsoup4 \
    scrapy \
    selenium \
    paramiko \
    cryptography \
    pycryptodome \
    pyftpdlib \
    sqlmap \
    dirsearch

# Install Go security tools
RUN go install github.com/projectdiscovery/nuclei/v2/cmd/nuclei@latest \
    && go install github.com/projectdiscovery/httpx/cmd/httpx@latest \
    && go install github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest \
    && go install github.com/OWASP/Amass/v3/...@latest

# Configure Metasploit
RUN msfdb init || true

# Create workspace directories
RUN mkdir -p /home/kasm-user/{workspace,loot,exploits,wordlists,tools} \
    && chown -R 1000:1000 /home/kasm-user

# Copy common wordlists
RUN mkdir -p /usr/share/wordlists \
    && ln -s /usr/share/wordlists /home/kasm-user/wordlists

# Set up desktop shortcuts
RUN mkdir -p $HOME/Desktop \
    && echo "[Desktop Entry]" > $HOME/Desktop/terminal.desktop \
    && echo "Type=Application" >> $HOME/Desktop/terminal.desktop \
    && echo "Name=Terminal" >> $HOME/Desktop/terminal.desktop \
    && echo "Exec=qterminal" >> $HOME/Desktop/terminal.desktop \
    && echo "Icon=utilities-terminal" >> $HOME/Desktop/terminal.desktop \
    && chmod +x $HOME/Desktop/terminal.desktop \
    && echo "[Desktop Entry]" > $HOME/Desktop/burpsuite.desktop \
    && echo "Type=Application" >> $HOME/Desktop/burpsuite.desktop \
    && echo "Name=Burp Suite" >> $HOME/Desktop/burpsuite.desktop \
    && echo "Exec=burpsuite" >> $HOME/Desktop/burpsuite.desktop \
    && echo "Icon=/usr/share/pixmaps/burpsuite.png" >> $HOME/Desktop/burpsuite.desktop \
    && chmod +x $HOME/Desktop/burpsuite.desktop

# Copy custom startup script
COPY custom_startup.sh $STARTUPDIR/custom_startup.sh
RUN chmod +x $STARTUPDIR/custom_startup.sh

# Configure proxychains for Tor
RUN echo "dynamic_chain" > /etc/proxychains4.conf \
    && echo "proxy_dns" >> /etc/proxychains4.conf \
    && echo "[ProxyList]" >> /etc/proxychains4.conf \
    && echo "socks5 127.0.0.1 9050" >> /etc/proxychains4.conf

######### End Customizations ###########

RUN chown 1000:0 $HOME
RUN $STARTUPDIR/set_user_permission.sh $HOME

ENV HOME /home/kasm-user
WORKDIR $HOME
RUN mkdir -p $HOME && chown -R 1000:0 $HOME

USER 1000
