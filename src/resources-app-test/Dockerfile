FROM node:24-alpine
WORKDIR /workspace

COPY src/resources-app/package*.json /workspace/src/resources-app/
COPY src/resources-app-test/package*.json /workspace/src/resources-app-test/

RUN npm --prefix /workspace/src/resources-app ci
RUN npm --prefix /workspace/src/resources-app-test ci

COPY src/resources-app/ /workspace/src/resources-app/
COPY src/resources-app-test/ /workspace/src/resources-app-test/

ENTRYPOINT ["npm", "--prefix", "/workspace/src/resources-app-test", "test"]
