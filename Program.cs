using SignalRChat.Hubs;

var builder = WebApplication.CreateBuilder(args);

// 1) CORS: allow your exact front‑end origin
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy
            .WithOrigins("https://collaboard-djb7e8caezeqbnef.centralus-01.azurewebsites.net")
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

// 2) SignalR + Azure SignalR
//    Requires "Azure:SignalR:ConnectionString" in appsettings or App Settings
builder.Services
    .AddSignalR()
    .AddAzureSignalR();

var app = builder.Build();

// 3) Serve static SPA
app.UseDefaultFiles();
app.UseStaticFiles();

// 4) Routing
app.UseRouting();

// 5) Apply CORS between routing & endpoints
app.UseCors();

// 6) Map hubs via Azure SignalR
app.UseAzureSignalR(routes =>
{
    routes.MapHub<ChatHub>("/chatHub");
});

// 7) SPA fallback
app.MapFallbackToFile("index.html");

app.Run();

