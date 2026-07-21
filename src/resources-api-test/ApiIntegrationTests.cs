using System.Net;
using System.Net.Http.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc.Testing;
using resources_api.Contracts;
using Xunit;

namespace resources_api_test
{
    public class ApiIntegrationTests
    {
        private readonly WebApplicationFactory<Program> _factory = new();

        [Fact]
        public async Task GetHealth_ReturnsOkStatusPayload()
        {
            var client = _factory.CreateClient();
            var response = await client.GetAsync("/health");
            var body = await response.Content.ReadFromJsonAsync<HealthResponse>();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.NotNull(body);
            Assert.Equal("ok", body!.Status);
        }

        [Fact]
        public async Task PostEcho_ReturnsEchoedMessageAndApiSource()
        {
            var client = _factory.CreateClient();
            var response = await client.PostAsJsonAsync("/echo", new EchoRequest { Message = "hola" });
            var body = await response.Content.ReadFromJsonAsync<EchoResponse>();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.NotNull(body);
            Assert.Equal("hola", body!.Message);
            Assert.Equal("api", body.Source);
        }
    }
}
