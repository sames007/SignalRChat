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

        // Maps peer ID to username
        private static readonly Dictionary<string, string> PeerUsernameMap = new();

        // Sync root for thread-safe dictionary updates
        private static readonly object _lock = new();

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
                    PeerUsernameMap.Remove(peerId);
                }
            }

            if (!string.IsNullOrEmpty(peerId) && !string.IsNullOrEmpty(room))
            {
                await Groups.RemoveFromGroupAsync(Context.ConnectionId, room);
                await Clients.Group(room).SendAsync("UserDisconnected", peerId);
            }

            await base.OnDisconnectedAsync(exception);
        }

        /// <summary>
        /// Client calls this to join, passing room, their PeerJS ID, and chosen username.
        /// Server returns existing peers + usernames and notifies others with name.
        /// </summary>
        public async Task JoinRoom(string room, string peerId, string username)
        {
            List<string> existingPeers;
            lock (_lock)
            {
                if (!Rooms.ContainsKey(room))
                    Rooms[room] = new HashSet<string>();

                existingPeers = Rooms[room].ToList();
                Rooms[room].Add(peerId);
                ConnectionPeerMap[Context.ConnectionId] = peerId;
                ConnectionRoomMap[Context.ConnectionId] = room;
                PeerUsernameMap[peerId] = username;
            }

            await Groups.AddToGroupAsync(Context.ConnectionId, room);

            // send existing peers + names back to caller
            var existingInfo = existingPeers
                .Select(id => new { PeerId = id, Username = PeerUsernameMap[id] })
                .ToList();
            await Clients.Caller.SendAsync("ExistingPeers", existingInfo);

            // tell everyone else who joined
            await Clients.OthersInGroup(room)
                         .SendAsync("UserConnected", peerId, username);
        }

        /// <summary>
        /// Broadcasts a chat message to all clients in the specified room.
        /// </summary>
        public Task BroadcastMessage(string room, string name, string message)
            => Clients.Group(room).SendAsync("broadcastMessage", name, message);

        /// <summary>
        /// Notifies everyone to toggle the background on a given peer’s video.
        /// </summary>
        public Task ToggleVirtualBackground(string room, string peerId)
            => Clients.Group(room).SendAsync("VirtualBackgroundToggled", peerId);

        /// <summary>
        /// Notifies everyone that a user raised their hand.
        /// </summary>
        public Task RaiseHand(string room, string peerId)
            => Clients.Group(room).SendAsync("UserRaisedHand", peerId);
    }
}
