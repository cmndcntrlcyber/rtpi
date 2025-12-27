# Kasm Firefox Workspace Image
# Phase 3: Workspace Images (#KW-18)
#
# This image provides Firefox browser with security testing extensions
# for web application pentesting.
#
# Build: docker build -t rtpi/kasm-firefox:latest ./kasm-images/firefox
# Run: Via Kasm Workspaces API

FROM kasmweb/firefox:1.17.0
USER root

ENV HOME /home/kasm-default-profile
ENV STARTUPDIR /dockerstartup
WORKDIR $HOME

######### Customize Container Here ###########

# Install additional tools for web testing
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    git \
    jq \
    python3 \
    python3-pip \
    netcat \
    && rm -rf /var/lib/apt/lists/*

# Install web testing tools
RUN pip3 install --no-cache-dir \
    requests \
    beautifulsoup4 \
    selenium \
    jwt

# Create workspace directory
RUN mkdir -p /home/kasm-user/{workspace,downloads} \
    && chown -R 1000:1000 /home/kasm-user

# Configure Firefox preferences for security testing
RUN mkdir -p $HOME/.mozilla/firefox/profile.default \
    && echo 'user_pref("browser.download.dir", "/home/kasm-user/downloads");' > $HOME/.mozilla/firefox/profile.default/user.js \
    && echo 'user_pref("browser.download.folderList", 2);' >> $HOME/.mozilla/firefox/profile.default/user.js \
    && echo 'user_pref("browser.download.useDownloadDir", true);' >> $HOME/.mozilla/firefox/profile.default/user.js \
    && echo 'user_pref("security.fileuri.strict_origin_policy", false);' >> $HOME/.mozilla/firefox/profile.default/user.js \
    && echo 'user_pref("network.proxy.type", 0);' >> $HOME/.mozilla/firefox/profile.default/user.js

# Copy custom startup script
COPY custom_startup.sh $STARTUPDIR/custom_startup.sh
RUN chmod +x $STARTUPDIR/custom_startup.sh

# Copy Firefox extension installer script
COPY install_extensions.sh /tmp/install_extensions.sh
RUN chmod +x /tmp/install_extensions.sh

######### End Customizations ###########

RUN chown 1000:0 $HOME
RUN $STARTUPDIR/set_user_permission.sh $HOME

ENV HOME /home/kasm-user
WORKDIR $HOME
RUN mkdir -p $HOME && chown -R 1000:0 $HOME

USER 1000
