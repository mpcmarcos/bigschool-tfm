using Microsoft.AspNetCore.Mvc;
using resources_api.Contracts;
using resources_api.Services;

namespace resources_api.Controllers
{
    [Route("echo")]
    [ApiController]
    public class EchoController : ControllerBase
    {
        private readonly IEchoService _echoService;

        public EchoController(IEchoService echoService)
        {
            _echoService = echoService;
        }

        [HttpPost]
        public ActionResult<EchoResponse> Post([FromBody] EchoRequest request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.Message))
            {
                return BadRequest("The message field is required.");
            }

            return Ok(_echoService.CreateResponse(request.Message));
        }
    }
}
