using Microsoft.AspNetCore.SignalR;

namespace SignalRChat.Hubs
{
    /// <summary>
    /// Hub for managing real‑time chat rooms with PeerJS integration.
    /// Tracks which peers are in which rooms, maps connections to peers/usernames,
    /// and broadcasts signaling and chat events to clients.
    /// </summary>
    public class ChatHub : Hub
    {
        // --- Shared state dictionaries (all guarded by _lock) ---

        /// <summary>
        /// For each room name, holds the set of PeerJS IDs currently in that room.
        /// </summary>
        private static readonly Dictionary<string, HashSet<string>> Rooms = new();

        /// <summary>
        /// Maps a SignalR connection ID to its corresponding PeerJS ID.
        /// Used to look up which peer is disconnecting or sending a message.
        /// </summary>
        private static readonly Dictionary<string, string> ConnectionPeerMap = new();

        /// <summary>
        /// Maps a SignalR connection ID to the room name it joined.
        /// Allows efficient removal of peers from the correct room on disconnect.
        /// </summary>
        private static readonly Dictionary<string, string> ConnectionRoomMap = new();

        /// <summary>
        /// Maps a PeerJS ID to the chosen username.
        /// Enables broadcasting of usernames alongside peer IDs.
        /// </summary>
        private static readonly Dictionary<string, string> PeerUsernameMap = new();

        /// <summary>
        /// Single lock object to ensure thread‑safe updates to the above dictionaries.
        /// </summary>
        private static readonly object _lock = new();

        /// <summary>
        /// Called automatically when a client disconnects.
        /// Removes the peer from all tracking dictionaries and notifies the room.
        /// </summary>
        public override async Task OnDisconnectedAsync(Exception exception)
        {
            string peerId = null, room = null;

            // Remove peer from in-memory state under lock
            lock (_lock)
            {
                // Try to find the peer and room for this connection
                if (ConnectionPeerMap.TryGetValue(Context.ConnectionId, out peerId) &&
                    ConnectionRoomMap.TryGetValue(Context.ConnectionId, out room))
                {
                    // Remove peer from the room set
                    Rooms[room].Remove(peerId);

                    // Clean up connection‑to‑peer and connection‑to‑room mappings
                    ConnectionPeerMap.Remove(Context.ConnectionId);
                    ConnectionRoomMap.Remove(Context.ConnectionId);

                    // Remove username mapping
                    PeerUsernameMap.Remove(peerId);
                }
            }

            // If we had a valid peer and room, notify others
            if (!string.IsNullOrEmpty(peerId) && !string.IsNullOrEmpty(room))
            {
                // Remove the connection from the SignalR group
                await Groups.RemoveFromGroupAsync(Context.ConnectionId, room);

                // Broadcast to the remaining clients in the room
                await Clients.Group(room)
                             .SendAsync("UserDisconnected", peerId);
            }

            // Call base to complete the disconnection process
            await base.OnDisconnectedAsync(exception);
        }

        /// <summary>
        /// Client calls this when joining a room. Registers their PeerJS ID and username,
        /// returns the list of existing peers to the caller, and notifies others.
        /// </summary>
        /// <param name="room">The chat room name to join.</param>
        /// <param name="peerId">The caller’s PeerJS ID.</param>
        /// <param name="username">The caller’s chosen display name.</param>
        public async Task JoinRoom(string room, string peerId, string username)
        {
            List<string> existingPeers;

            // Update shared state under lock
            lock (_lock)
            {
                // If the room doesn’t exist yet, create its peer set
                if (!Rooms.ContainsKey(room))
                {
                    Rooms[room] = new HashSet<string>();
                }

                // Capture the list of peers already in the room
                existingPeers = Rooms[room].ToList();

                // Add the new peer to the room set
                Rooms[room].Add(peerId);

                // Map this connection to the peer ID and room
                ConnectionPeerMap[Context.ConnectionId] = peerId;
                ConnectionRoomMap[Context.ConnectionId] = room;

                // Store the peer’s username
                PeerUsernameMap[peerId] = username;
            }

            // Add the connection to the SignalR group for broadcasting
            await Groups.AddToGroupAsync(Context.ConnectionId, room);

            // Prepare info about existing peers for the new caller
            var existingInfo = existingPeers
                .Select(id => new { PeerId = id, Username = PeerUsernameMap[id] })
                .ToList();

            // Send the list of existing peers and their usernames back to the caller
            await Clients.Caller.SendAsync("ExistingPeers", existingInfo);

            // Notify everyone else in the room that a new user has connected
            await Clients.OthersInGroup(room)
                         .SendAsync("UserConnected", peerId, username);
        }

        /// <summary>
        /// Broadcasts a chat message to all clients in the room.
        /// </summary>
        /// <param name="room">Room name where the message should be sent.</param>
        /// <param name="name">Sender’s display name.</param>
        /// <param name="message">The chat text.</param>
        public Task BroadcastMessage(string room, string name, string message)
            => Clients.Group(room)
                      .SendAsync("broadcastMessage", name, message);

        /// <summary>
        /// Instructs clients to toggle a virtual background on a specific peer’s video.
        /// </summary>
        /// <param name="room">Target room name.</param>
        /// <param name="peerId">PeerJS ID whose background should toggle.</param>
        public Task ToggleVirtualBackground(string room, string peerId)
            => Clients.Group(room)
                      .SendAsync("VirtualBackgroundToggled", peerId);

        /// <summary>
        /// Broadcasts that a user has raised their hand.
        /// </summary>
        public Task RaiseHand(string room, string peerId)
            => Clients.Group(room)
                      .SendAsync("UserRaisedHand", peerId);

        /// <summary>
        /// Broadcasts that a user has started screen sharing.
        /// </summary>
        public Task StartScreenShare(string room, string peerId)
            => Clients.Group(room)
                      .SendAsync("ScreenShareStarted", peerId);

        /// <summary>
        /// Broadcasts that a user has toggled recording.
        /// </summary>
        public Task ToggleRecording(string room, string peerId)
            => Clients.Group(room)
                      .SendAsync("RecordingToggled", peerId);

        /// <summary>
        /// Broadcasts that a user has stopped screen sharing.
        /// </summary>
        public Task StopScreenShare(string room, string peerId)
            => Clients.Group(room)
                      .SendAsync("ScreenShareStopped", peerId);
    }
}
