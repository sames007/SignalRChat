using Microsoft.AspNetCore.SignalR;

namespace SignalRChat.Hubs
{
    public class ChatHub : Hub
    {
        // Tracks peer IDs grouped by room name
        private static readonly Dictionary<string, HashSet<string>> Rooms = new();

        // Maps each SignalR connection ID to its PeerJS ID
        private static readonly Dictionary<string, string> ConnectionPeerMap = new();

        // Maps each SignalR connection ID to the room it joined
        private static readonly Dictionary<string, string> ConnectionRoomMap = new();

        // Sync root for thread‑safe dictionary updates
        private static readonly object _lock = new();

        /// <summary>
        /// Called automatically when a client disconnects.
        /// Cleans up mappings and notifies others in the same room.
        /// </summary>
        public override async Task OnDisconnectedAsync(Exception exception)
        {
            string peerId = null, room = null;

            lock (_lock)
            {
                if (ConnectionPeerMap.TryGetValue(Context.ConnectionId, out peerId) &&
                    ConnectionRoomMap.TryGetValue(Context.ConnectionId, out room))
                {
                    Rooms[room].Remove(peerId);
                    ConnectionPeerMap.Remove(Context.ConnectionId);
                    ConnectionRoomMap.Remove(Context.ConnectionId);
                }
            }

            if (!string.IsNullOrEmpty(peerId) && !string.IsNullOrEmpty(room))
            {
                // Remove from SignalR group and broadcast disconnect event
                await Groups.RemoveFromGroupAsync(Context.ConnectionId, room);
                await Clients.Group(room).SendAsync("UserDisconnected", peerId);
            }

            await base.OnDisconnectedAsync(exception);
        }

        /// <summary>
        /// Client invokes this to join a room and share its PeerJS ID.
        /// Returns the list of existing peers and notifies others.
        /// </summary>
        public async Task JoinRoom(string room, string peerId)
        {
            List<string> existingPeers;

            lock (_lock)
            {
                if (!Rooms.ContainsKey(room))
                {
                    Rooms[room] = new HashSet<string>();
                }

                existingPeers = new List<string>(Rooms[room]);
                Rooms[room].Add(peerId);
                ConnectionPeerMap[Context.ConnectionId] = peerId;
                ConnectionRoomMap[Context.ConnectionId] = room;
            }

            // Add this client to the SignalR group for broadcasting
            await Groups.AddToGroupAsync(Context.ConnectionId, room);

            // Send existing peer list to the caller
            await Clients.Caller.SendAsync("ExistingPeers", existingPeers);

            // Inform other clients in the room about the new peer
            await Clients.OthersInGroup(room).SendAsync("UserConnected", peerId);
        }

        /// <summary>
        /// Broadcasts a chat message to all clients in the specified room.
        /// </summary>
        public Task BroadcastMessage(string room, string name, string message)
        {
            return Clients.Group(room).SendAsync("broadcastMessage", name, message);
        }
    }
}

