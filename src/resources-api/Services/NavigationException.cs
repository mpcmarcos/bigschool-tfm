using System.Net;

namespace resources_api.Services
{
    public class NavigationException : Exception
    {
        public NavigationException(HttpStatusCode statusCode, string message) : base(message)
        {
            StatusCode = statusCode;
        }

        public HttpStatusCode StatusCode { get; }
    }
}
