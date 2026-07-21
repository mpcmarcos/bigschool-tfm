using Microsoft.AspNetCore.Mvc;
using resources_api.Contracts;

namespace resources_api.Controllers
{
    [Route("health")]
    [ApiController]
    public class HealthController : ControllerBase
    {
        [HttpGet]
        public ActionResult<HealthResponse> Get()
        {
            return Ok(new HealthResponse
            {
                Status = "ok"
            });
        }
    }
}
