using System.Net;

namespace resources_api.Services
{
    public class ProjectException : Exception
    {
        public ProjectException(HttpStatusCode statusCode, string message) : base(message)
        {
            StatusCode = statusCode;
        }

        public HttpStatusCode StatusCode { get; }
    }
}
