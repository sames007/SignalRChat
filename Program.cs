using SignalRChat.Hubs;

var builder = WebApplication.CreateBuilder(args);

// ------------------------------------------------------
// 1) Configure CORS to allow only specific front-end origins
// ------------------------------------------------------
// This policy permits cross-origin requests from the
// production and local development URLs, allows any HTTP header
// and method, and supports credentialed (cookie or token) requests.
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.WithOrigins(
                "https://collaboard-djb7e8caezeqbnef.centralus-01.azurewebsites.net", // Production SPA URL
                "http://localhost:5000"                                             // Localhost development
            )
            .AllowAnyHeader()    // Allow all request headers
            .AllowAnyMethod()    // Allow GET, POST, etc.
            .AllowCredentials()  // Allow cookies or other credentials
    );
});

// ------------------------------------------------------
// 2) Register SignalR services and Azure SignalR backplane
// ------------------------------------------------------
// - AddSignalR(): Registers the core SignalR services.
// - AddAzureSignalR(): Connects the app to Azure SignalR Service
//   using the "Azure:SignalR:ConnectionString" setting.
// This enables scalable, multi-instance real-time messaging.
builder.Services
    .AddSignalR()          // Adds SignalR core services
    .AddAzureSignalR();    // Configures Azure SignalR Service integration

// Build the WebApplication
var app = builder.Build();

// ------------------------------------------------------
// 3) Serve static files for the Single Page Application
// ------------------------------------------------------
// UseDefaultFiles(): Rewrites requests for "/" to "/index.html" (first matching default file).
// UseStaticFiles(): Serves static assets from the "wwwroot" folder.
// Order is important: DefaultFiles must come before StaticFiles.
app.UseDefaultFiles();    // URL rewriter for default documents (index.html, etc.) :contentReference[oaicite:4]{index=4}
app.UseStaticFiles();     // Enables serving .js, .css, images, etc.

// ------------------------------------------------------
// 4) Enable routing middleware
// ------------------------------------------------------
// This adds route matching to the middleware pipeline.
// Must be called before mapping endpoints.
app.UseRouting();

// ------------------------------------------------------
// 5) Apply the CORS policy to all incoming requests
// ------------------------------------------------------
app.UseCors();

// ------------------------------------------------------
// 6) Map the SignalR ChatHub endpoint via Azure SignalR
// ------------------------------------------------------
// UseAzureSignalR(): Intercepts SignalR negotiate requests and
// routes them through the Azure SignalR Service.
// MapHub<ChatHub>("/chatHub"): Defines the client-accessible
// URL for the ChatHub.
app.UseAzureSignalR(routes =>
{
    routes.MapHub<ChatHub>("/chatHub");
});

// ------------------------------------------------------
// 7) SPA fallback for client-side routing
// ------------------------------------------------------
// Sends any non-API or non-static-file request back to index.html
// so that the SPA router can handle the URL. :contentReference[oaicite:5]{index=5}
app.MapFallbackToFile("index.html");

// ------------------------------------------------------
// 8) Run the application
// ------------------------------------------------------
app.Run();
