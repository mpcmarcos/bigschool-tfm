using resources_api.Services;
using Xunit;

namespace resources_api_test
{
    public class EchoServiceTests
    {
        [Fact]
        public void CreateResponse_ReturnsExpectedPayload()
        {
            var service = new EchoService();

            var result = service.CreateResponse("hola");

            Assert.Equal("hola", result.Message);
            Assert.Equal("api", result.Source);
        }
    }
}
