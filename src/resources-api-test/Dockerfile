FROM mcr.microsoft.com/dotnet/sdk:8.0
WORKDIR /src

COPY src/resources-api/resources-api.csproj src/resources-api/
COPY src/resources-api-test/resources-api-test.csproj src/resources-api-test/
RUN dotnet restore src/resources-api-test/resources-api-test.csproj

COPY src/resources-api/ src/resources-api/
COPY src/resources-api-test/ src/resources-api-test/

ENTRYPOINT ["dotnet", "test", "src/resources-api-test/resources-api-test.csproj", "-c", "Release", "--no-restore"]
