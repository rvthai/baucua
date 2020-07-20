const rooms = [];

const createRoom = ({ id, name, room }) => {
  const r = {roomId:room, active: false, players:[]};
  const user = {id,name,room};
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
  const user = {id,name,room};
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
  const playerList = rooms[index].players;
  const playerIndex = playerList.findIndex((user) => user.id === id)
  if (index !== -1){
    const user = playerList.splice(playerIndex, 1)[0];
    if (rooms[index].players.length === 0){
      rooms.splice(index,1);
    }
    return user;
  }
}


const findRoom = (room) => rooms.filter((r) => r.roomId === room);


module.exports = {createRoom, joinRoom, getUserInRoom, removeUser,findRoom};