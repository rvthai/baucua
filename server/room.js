const rooms = [];

const createRoom = ({ id, name, room }) => {
  const r = {roomId:room, active: false, players:[], bets:[], dice:[]};
  const user = {id,name,room, total:0, current:0};
  const index = rooms.findIndex((rm) => rm.roomId === room);
  if (index !== -1){
    return {error: 'Room already exist'};
  }
  r.players.push(user);
  rooms.push(r);
  
  return {user};
}

const joinRoom = ({ id, name, room }) => {
  const index = rooms.findIndex((r) => r.roomId === room);
  const user = {id,name,room, total:0, current:0};
  if (index === -1){
    return {error: 'Room does not exist'};
  }
  
  rooms[index].players.push(user);
  return {user};
}

const getUserInRoom = (room) => {
  const roomList = rooms.filter((r) => r.roomId === room );
  if (roomList.length === 0){
    return {error: 'Room does not exist'};
  }
  return roomList[0].players;
  
}

const removeUser = ({id, room}) => {
  const index = rooms.findIndex((rm) => rm.roomId === room);
  if (index !== -1){
    const playerList = rooms[index].players;
    const playerIndex = playerList.findIndex((user) => user.id === id)
    const user = playerList.splice(playerIndex, 1)[0];
    if (rooms[index].players.length === 0){
      rooms.splice(index,1);
    }
    return user;
  }
}

const findRoom = (room) => rooms.filter((r) => r.roomId === room);

const getRoom = ({room}) =>{
  const index = rooms.findIndex((rm) => rm.roomId === room);
  if (index !== -1){
    rooms[index].active = true;
    return rooms[index];
  }
  return {error: 'Room does not exist'};
}

//GAME FUNCTIONS
const addBet = ({room, id, amount, animal}) => {
  const gameroom = rooms.find((rm) => rm.roomId === room);
  if (gameroom){
    const player = gameroom.players.find((pl) => pl.id === id);
    if (gameroom && player){
        const playerbet = gameroom.bets.find((pb) => pb.id === id && pb.animal === animal);
        if (playerbet){
          playerbet.amount += amount;
          gameroom.players[0].total += amount;
        }else{
          const bet = {id:id, animal:animal, amount:amount};
          gameroom.players[0].total += amount;
          gameroom.bets.push(bet);
        }
        player.total -= amount;
        player.current += amount;
    }
    return gameroom;
  }
}

const rollDice = ({room}) => {
  const gameroom = rooms.find((rm) => rm.roomId === room);
  
  const animals = ["deer","bau","chicken","fish","crab","shrimp"];
  let a = animals.length, k, temp;
  while(--a > 0){
      k = Math.floor(Math.random()*(a+1));
      temp = animals[k];
      animals[k] = animals[a];
      animals[a] = temp;
  }

  const dice = [];
  let die;
  for (die = 0; die < 3; die++){
      const index = Math.floor(Math.random()*6);
      const multiple = dice.find((ani) => ani.animal === animals[index]);
      if (multiple){
          multiple.val += 1;
      }else{
          const d = {animal: animals[index], val: 1};
          dice.push(d);
      }
  }
  gameroom.dice = dice;
  return calculateProfit(room);
}

const calculateProfit = (room) =>{
  const gameroom = rooms.find((rm) => rm.roomId === room);
  for (let die = 0; die < gameroom.dice.length; ++die){
      const bet = gameroom.bets.filter((b) => b.animal === gameroom.dice[die].animal);
      if (bet.length > 0){
          for (let win = 0; win < bet.length; ++win){
              const player = gameroom.players.find((p) => p.id === bet[0].id);
              player.total += bet[0].amount*gameroom.dice[die].val+bet[0].amount;
              gameroom.players[0].total -= bet[0].amount*gameroom.dice[die].val;
          }
      }
  }
  for (let p = 0; p < gameroom.players.length; ++p){
      gameroom.players[p].current = 0;
  }
  gameroom.bets = [];
  return gameroom;
}

module.exports = {createRoom, joinRoom, getUserInRoom, removeUser,findRoom, getRoom, addBet, rollDice};