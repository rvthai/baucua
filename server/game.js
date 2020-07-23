gamerooms = [];

createGameRoom = ({room, players}) => {
    let index;
    gameroom = {room: room, players: [], bets:[], dice: []};
    for (index = 0; index < players.length; ++index){
        const player = {id:players[index].id, name:players[index].name, total: 0, current: 0};
        gameroom.players.push(player);
    }
    gamerooms.push(gameroom);
    return gameroom;
}

addBet = ({room, id, amount, animal}) => {
    const gameroom = gamerooms.find((rm) => rm.room === room);
    const player = gameroom.players.find((pl) => pl.id === id);
    if (gameroom && player){
        const bet = {id:id, animal:animal, amount:amount};
        player.total -= amount;
        player.current += amount;
        gameroom.bets.push(bet);
    }
    return gameroom;
}

rollDice = ({room}) => {
    const gameroom = gamerooms.find((rm) => rm.room === room);
    
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

calculateProfit = (room) =>{
    const gameroom = gamerooms.find((rm) => rm.room === room);
    for (let die = 0; die < gameroom.dice.length; ++die){
        const bet = gameroom.bets.filter((b) => b.animal === gameroom.dice[die].animal);
        if (bet.length > 0){
            for (let win = 0; win < bet.length; ++win){
                const player = gameroom.players.find((p) => p.id === bet[0].id);
                player.total += bet[0].amount*2*gameroom.dice[die].val;
            }
        }
    }
    for (let p = 0; p < gameroom.players.length; ++p){
        const difference = gameroom.players[p].current - gameroom.players[p].total;
        //host.total += difference
        gameroom.players[p].current = 0;
    }
    gameroom.bets = [];
    return gameroom;
}

module.exports = {createGameRoom, addBet, rollDice};