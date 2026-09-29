FROM mongo:7.0

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 27017

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
