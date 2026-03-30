const supabase = window.supabaseClient;

async function handleLogin(){
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  await supabase.auth.signInWithPassword({ email, password });
}

supabase.auth.onAuthStateChange((event, session)=>{
  if(session) initApp();
});

async function initApp(){
  document.getElementById("login-box").style.display="none";
  document.getElementById("app").style.display="block";
  loadWatchlist();
  loadStats();
}

async function loadWatchlist(){
  const { data } = await supabase.from("watchlist").select("*");
  if(!data) return;
  document.getElementById("watchlist").innerHTML =
    data.map(x=>`<tr>
      <td>${x.ticker}</td>
      <td>${x.total_score}</td>
      <td><button onclick='buy(${JSON.stringify(x)})'>BUY</button></td>
    </tr>`).join("");
}

async function buy(item){
  await supabase.from("journal").insert([{
    ticker:item.ticker,
    buy_price:item.current_price,
    status:"open"
  }]);
  alert("Đã vào lệnh");
}

async function loadStats(){
  const { data } = await supabase.from("journal").select("*");
  if(!data) return;

  const wins = data.filter(x=>x.pnl>0);
  const losses = data.filter(x=>x.pnl<0);

  document.getElementById("winrate").innerText = (wins.length/data.length*100 || 0).toFixed(1)+"%";
  document.getElementById("totalTrades").innerText = data.length;
  document.getElementById("avgWin").innerText = (wins.reduce((a,b)=>a+b.pnl,0)/wins.length || 0).toFixed(2);
  document.getElementById("avgLoss").innerText = (losses.reduce((a,b)=>a+b.pnl,0)/losses.length || 0).toFixed(2);
}

function calcKelly(){
  const win = document.getElementById("win").value/100;
  const rr = document.getElementById("rr").value;
  const mode = document.getElementById("mode").value;

  let k = win - ((1-win)/rr);
  if(mode==="half") k*=0.5;
  if(mode==="quarter") k*=0.25;

  document.getElementById("kelly").innerText = "Kelly: "+(k*100).toFixed(2)+"%";
}
