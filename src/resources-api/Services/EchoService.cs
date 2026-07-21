using resources_api.Contracts;

namespace resources_api.Services
{
    public class EchoService : IEchoService
    {
        public EchoResponse CreateResponse(string message)
        {
            return new EchoResponse
            {
                Message = message,
                Source = "api"
            };
        }
    }
}
