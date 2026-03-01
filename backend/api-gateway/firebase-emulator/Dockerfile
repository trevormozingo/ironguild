FROM node:20-slim

RUN npm install -g firebase-tools

# Create a minimal firebase.json that enables only the Auth emulator
WORKDIR /app
RUN echo '{ \
  "emulators": { \
    "auth": { \
      "host": "0.0.0.0", \
      "port": 9099 \
    } \
  } \
}' > firebase.json

EXPOSE 9099

CMD ["firebase", "emulators:start", "--only", "auth", "--project", "ironguild-local"]
