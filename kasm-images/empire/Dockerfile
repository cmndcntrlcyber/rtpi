# Kasm Empire Client Workspace Image
# Phase 3: Workspace Images (#KW-19)
#
# This image provides PowerShell Empire client pre-configured
# to connect to RTPI Empire C2 server.
#
# Build: docker build -t rtpi/kasm-empire:latest ./kasm-images/empire
# Run: Via Kasm Workspaces API

FROM kasmweb/core-ubuntu-focal:1.17.0
USER root

ENV HOME /home/kasm-default-profile
ENV STARTUPDIR /dockerstartup
WORKDIR $HOME

######### Customize Container Here ###########

# Install dependencies
RUN apt-get update && apt-get install -y \
    git \
    python3 \
    python3-pip \
    curl \
    wget \
    vim \
    tmux \
    jq \
    && rm -rf /var/lib/apt/lists/*

# Clone PowerShell Empire (client only)
RUN git clone --depth 1 https://github.com/BC-SECURITY/Empire.git /opt/Empire \
    && cd /opt/Empire \
    && pip3 install -r requirements.txt

# Install Empire client dependencies
RUN pip3 install --no-cache-dir \
    requests \
    prompt_toolkit \
    terminaltables \
    pyOpenSSL

# Create Empire client configuration
RUN mkdir -p /home/kasm-user/.empire \
    && echo "# Empire Client Configuration" > /home/kasm-user/.empire/config.yaml \
    && echo "server:" >> /home/kasm-user/.empire/config.yaml \
    && echo "  host: empire-server" >> /home/kasm-user/.empire/config.yaml \
    && echo "  port: 1337" >> /home/kasm-user/.empire/config.yaml \
    && echo "  username: empireadmin" >> /home/kasm-user/.empire/config.yaml \
    && echo "  # password will be set via environment variable" >> /home/kasm-user/.empire/config.yaml

# Create workspace directories
RUN mkdir -p /home/kasm-user/{workspace,loot,stagers,modules} \
    && chown -R 1000:1000 /home/kasm-user

# Set up desktop shortcuts
RUN mkdir -p $HOME/Desktop \
    && echo "[Desktop Entry]" > $HOME/Desktop/empire-client.desktop \
    && echo "Type=Application" >> $HOME/Desktop/empire-client.desktop \
    && echo "Name=Empire Client" >> $HOME/Desktop/empire-client.desktop \
    && echo "Exec=qterminal -e /opt/Empire/empire --rest" >> $HOME/Desktop/empire-client.desktop \
    && echo "Icon=utilities-terminal" >> $HOME/Desktop/empire-client.desktop \
    && chmod +x $HOME/Desktop/empire-client.desktop

# Copy connection script
COPY connect_empire.sh /usr/local/bin/connect-empire
RUN chmod +x /usr/local/bin/connect-empire

# Copy custom startup script
COPY custom_startup.sh $STARTUPDIR/custom_startup.sh
RUN chmod +x $STARTUPDIR/custom_startup.sh

######### End Customizations ###########

RUN chown 1000:0 $HOME
RUN $STARTUPDIR/set_user_permission.sh $HOME

ENV HOME /home/kasm-user
WORKDIR $HOME
RUN mkdir -p $HOME && chown -R 1000:0 $HOME

USER 1000
