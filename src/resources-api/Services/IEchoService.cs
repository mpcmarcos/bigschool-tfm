using resources_api.Contracts;

namespace resources_api.Services
{
    public interface IEchoService
    {
        EchoResponse CreateResponse(string message);
    }
}
