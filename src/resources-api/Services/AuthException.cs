using System.Net;

namespace resources_api.Services
{
    public class AuthException : Exception
    {
        public AuthException(HttpStatusCode statusCode, string detail) : base(detail)
        {
            StatusCode = statusCode;
        }

        public HttpStatusCode StatusCode { get; }
    }
}
