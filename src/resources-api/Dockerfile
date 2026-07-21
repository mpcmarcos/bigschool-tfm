FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY src/resources-api/resources-api.csproj src/resources-api/
RUN dotnet restore src/resources-api/resources-api.csproj

COPY src/resources-api/ src/resources-api/
RUN dotnet publish src/resources-api/resources-api.csproj -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

COPY --from=build /app/publish ./

ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

ENTRYPOINT ["dotnet", "resources-api.dll"]
