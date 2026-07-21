using resources_api.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddCors(options =>
{
    options.AddPolicy("LocalDev", policy =>
    {
        policy
            .AllowAnyOrigin()
            .AllowAnyMethod()
            .AllowAnyHeader();
    });
});
builder.Services.AddSingleton<IEchoService, EchoService>();
builder.Services.AddControllers();

var app = builder.Build();

app.UseCors("LocalDev");
app.MapControllers();

app.Run();

public partial class Program
{
}
