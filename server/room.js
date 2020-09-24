// Global data structures
const rooms = [];
const chatrooms = [];

// Functions that handle room events
// Create and add a new room to the server
const createRoom = (id, room) => {
  const colors = [
    "#c04e48", //red
    "#4a7eac", //blue
    "#d3c56e", //yellow
    "#4e9e58", //green
    "#ca7f3e", //orange
    "#7fc7b1", //teal
    "#ca709d", //pink
    "#903c9c", //purple
  ];

  const r = {
    roomId: room,
    active: false,
    host: id,
    players: [],
    bets: [],
    dice: [],
    colors: colors,
    settings: { time: 30, rounds: 5, balance: 10 },
    round: 1,
    timer: 30,
  };

  const c = {
    roomId: room,
    messages: [],
  };

  rooms.push(r);
  chatrooms.push(c);
};

// Add a player to a room
const joinRoom = (id, name, room) => {
  const gameroom = findRoom(room)[0];
  if (gameroom === undefined) return null;

  const color = gameroom.colors.shift();

  const user = {
    id,
    name,
    color,
    room,
    total: 0,
    net: 0,
    rank: 1,
    bankrupt: false,
    ready: false,
  };

  gameroom.players.push(user);

  return user;
};

const checkRoom = (room) => {
  const r = findRoom(room);

  if (r.length === 0) {
    return "The room you tried to enter does not exist.";
  } else if (r.length > 0 && r[0].players.length >= 8) {
    return "The room you tried to enter is already full.";
  } else if (r[0].active) {
    return "The room you tried to enter has already started.";
  }

  return false;
};

const changeRoomSettings = (room, setting, value) => {
  const gameroom = findRoom(room)[0];
  if (gameroom === undefined) return null;

  if (setting === "time") {
    gameroom.settings.time = value;
    gameroom.timer = value;
  } else if (setting === "rounds") {
    gameroom.settings.rounds = value;
  } else if (setting === "balance") {
    gameroom.settings.balance = value;
  }

  return value;
};

const findRoom = (room) => rooms.filter((r) => r.roomId === room);

// Functions that handle gamestate
// Set all player balances and gameroom to active
const setInitialGamestate = (room, balance) => {
  const gameroom = findRoom(room)[0];
  if (gameroom === undefined) return null;

  gameroom.active = true;

  for (let i = 0; i < gameroom.players.length; i++) {
    gameroom.players[i].total = balance;
  }

  return gameroom;
};

// Clear the gamestate and deactivate gameroom
const resetGamestate = (room) => {
  const gameroom = findRoom(room)[0];
  if (gameroom === undefined) return null;

  gameroom.active = false;
  gameroom.bets = [];
  gameroom.dice = [];
  gameroom.round = 1;

  for (let i = 0; i < gameroom.players.length; i++) {
    gameroom.players[i].total = 0;
    gameroom.players[i].net = 0;
    gameroom.players[i].rank = 1;
    gameroom.players[i].bankrupt = false;
    gameroom.players[i].ready = false;
  }

  return gameroom;
};

// Go to next round
const nextRound = (room) => {
  const gameroom = findRoom(room)[0];
  if (gameroom === undefined) return null;

  gameroom.round += 1;
  if (gameroom.round > gameroom.settings.rounds) {
    return -1;
  }
  return gameroom.round;
};

// Functions that handle betting
// Add a bet
const addBet = (room, id, amount, animal) => {
  const gameroom = findRoom(room)[0];
  if (gameroom === undefined) return null;

  const player = gameroom.players.find((p) => p.id === id);

  const playerbet = gameroom.bets.find(
    (pb) => pb.id === id && pb.animal === animal
  );

  if (playerbet) {
    playerbet.amount += amount;
  } else {
    const bet = {
      id: player.id,
      animal: animal,
      amount: amount,
      color: player.color,
    };

    gameroom.bets.push(bet);
  }

  player.total -= amount;
  player.net -= amount;

  return gameroom;
};

// Remove a bet
const removeBet = (room, id, amount, animal) => {
  const gameroom = findRoom(room)[0];
  if (gameroom === undefined) return null;

  const player = gameroom.players.find((p) => p.id === id);

  const playerbet = gameroom.bets.find(
    (pb) => pb.id === id && pb.animal === animal
  );

  if (playerbet) {
    const index = gameroom.bets.findIndex(
      (b) => b.id === id && b.animal === animal
    );
    gameroom.bets.splice(index, 1);
    player.total += amount;
    player.net += amount;
  }

  return gameroom;
};

// Clear all bets
const clearBets = (room) => {
  const gameroom = findRoom(room)[0];
  if (gameroom === undefined) return null;

  gameroom.bets = [];

  return gameroom;
};

// Clear all nets
const clearNets = (room) => {
  const gameroom = findRoom(room)[0];
  if (gameroom === undefined) return null;

  for (let i = 0; i < gameroom.players.length; i++) {
    gameroom.players[i].net = 0;
  }

  return gameroom;
};

// Functions that handle score calculation
// Calculate total scores
const calculateBets = (room) => {
  const gameroom = findRoom(room)[0];
  if (gameroom === undefined) return null;

  let prev_rolls = [];
  for (let die = 0; die < gameroom.dice.length; ++die) {
    const bets = gameroom.bets.filter((b) => b.animal === gameroom.dice[die]);

    if (bets.length > 0) {
      for (let win = 0; win < bets.length; ++win) {
        const player = gameroom.players.find((p) => p.id === bets[win].id);

        if (prev_rolls.find((d) => d === gameroom.dice[die])) {
          player.total += bets[win].amount;
        } else {
          player.total += bets[win].amount * 2;
        }
      }

      prev_rolls.push(gameroom.dice[die]);
    }
  }

  // Unready players after calculation
  for (let p = 0; p < gameroom.players.length; ++p) {
    gameroom.players[p].ready = false;

    // Check for bankruptcy
    if (gameroom.players[p].total === 0) {
      gameroom.players[p].bankrupt = true;
      gameroom.players[p].ready = true;
    }
  }

  return setRankingsByTotal(gameroom);
};

// Calculate net scores
const calculateNets = (room) => {
  const gameroom = findRoom(room)[0];
  if (gameroom === undefined) return null;

  let prev_rolls = [];
  for (let die = 0; die < gameroom.dice.length; ++die) {
    const bets = gameroom.bets.filter((b) => b.animal === gameroom.dice[die]);

    if (bets.length > 0) {
      for (let win = 0; win < bets.length; ++win) {
        const player = gameroom.players.find((p) => p.id === bets[win].id);

        if (prev_rolls.find((d) => d === gameroom.dice[die])) {
          player.net += bets[win].amount;
        } else {
          player.net += bets[win].amount * 2;
        }
      }

      prev_rolls.push(gameroom.dice[die]);
    }
  }

  return setRankingsByNet(gameroom);
};

// Check for bankruptcy
const checkBankrupt = (room) => {
  const gameroom = findRoom(room)[0];
  if (gameroom === undefined) return null;

  const players = gameroom.players;
  for (let p = 0; p < players.length; p++) {
    if (!players[p].bankrupt) {
      return false;
    }
  }

  return true;
};

// Functions that handle the dice roll
// Roll the dice
const rollDice = (room) => {
  const gameroom = findRoom(room)[0];
  if (gameroom === undefined) return null;

  const animals = ["deer", "gourd", "rooster", "fish", "crab", "shrimp"];

  // Resort array for extra randomness
  let a = animals.length,
    k,
    temp;
  while (--a > 0) {
    k = Math.floor(Math.random() * (a + 1));
    temp = animals[k];
    animals[k] = animals[a];
    animals[a] = temp;
  }

  const dice = [];
  let die;
  for (die = 0; die < 3; die++) {
    const index = Math.floor(Math.random() * 6);
    const d = animals[index];
    dice.push(d);
  }

  gameroom.dice = dice;

  return gameroom;
};

// Functions that handle player events
// Set player's ready status to true
const setReady = (room, id) => {
  const gameroom = findRoom(room)[0];
  if (gameroom === undefined) return null;

  const player = gameroom.players.find((user) => user.id === id);
  player.ready = true;

  return gameroom;
};

// Check if all players are ready
const allPlayersReady = (room) => {
  const gameroom = findRoom(room)[0];
  if (gameroom === undefined) return null;
  return allReady(gameroom);
};

// Remove the player from the room
const removePlayer = (id, room) => {
  const room_index = rooms.findIndex((rm) => rm.roomId === room);
  if (room_index === -1) return null;

  const players = rooms[room_index].players;
  const player_index = players.findIndex((user) => user.id === id);
  if (player_index === -1) return null;
  const player = players.splice(player_index, 1)[0];

  const chat_index = chatrooms.findIndex((cr) => cr.roomId === room);

  // Return the color back to the room
  rooms[room_index].colors.unshift(player.color);

  // If there are no more players in the room, remove the room and chatroom from the database
  if (rooms[room_index].players.length === 0) {
    rooms.splice(room_index, 1);
    chatrooms.splice(chat_index, 1);
  }

  return player;
};

// Functions that handle the chat
// Add a message to the chatroom
const addMessage = (id, room, name, message) => {
  const chatroom = chatrooms.find((c) => c.roomId === room);
  const gameroom = findRoom(room)[0];
  if (gameroom === undefined) return null;

  const player = gameroom.players.find((p) => p.id === id);

  const messageObject = {
    name: name,
    color: player.color,
    message: message,
  };

  chatroom.messages.push(messageObject);

  return chatroom.messages;
};

// Functions that handle the timer
// Reset the timer
const resetTime = (room) => {
  const gameroom = findRoom(room)[0];
  if (gameroom === undefined) return null;

  gameroom.timer = gameroom.settings.time;

  return gameroom.timer;
};

// Count down the timer by 1s
const countdown = (room) => {
  const gameroom = findRoom(room)[0];
  if (gameroom === undefined || allReady(gameroom)) {
    return null;
  }

  gameroom.timer -= 1;

  return gameroom.timer;
};

// Helper functions
// Sort and return rankings based off the total scores
const setRankingsByTotal = (gameroom) => {
  const players = gameroom.players;
  const sorted_players = [...players].sort((a, b) => {
    return b.total - a.total;
  });

  // Set rankings
  sorted_players[0].rank = 1;
  for (let i = 1; i < sorted_players.length; i++) {
    if (sorted_players[i].total === sorted_players[i - 1].total) {
      sorted_players[i].rank = sorted_players[i - 1].rank;
    } else {
      sorted_players[i].rank = sorted_players[i - 1].rank + 1;
    }
  }

  return sorted_players;
};

// Sort and return rankings based on net scores
const setRankingsByNet = (gameroom) => {
  const players = gameroom.players;
  const sorted_players = [...players].sort((a, b) => {
    return b.net - a.net;
  });

  return sorted_players;
};

// Check if all players are ready
const allReady = (gameroom) => {
  const players = gameroom.players;

  for (let i = 0; i < players.length; i++) {
    if (players[i].ready === false) {
      return false;
    }
  }

  return true;
};

// Module Exports
module.exports = {
  createRoom,
  joinRoom,
  checkRoom,
  changeRoomSettings,
  findRoom,
  setInitialGamestate,
  resetGamestate,
  nextRound,
  addBet,
  removeBet,
  clearBets,
  clearNets,
  calculateBets,
  calculateNets,
  checkBankrupt,
  rollDice,
  setReady,
  allPlayersReady,
  removePlayer,
  addMessage,
  resetTime,
  countdown,
};
