
(()=>{
const $=id=>document.getElementById(id);
const CK='mrall_personal_supabase_config_v1';
let sb=null,user=null,accounts=[],tx=[];

const rp=n=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(n)||0);
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

function msg(s,err=false){
$('msg').textContent=s;
$('msg').classList.toggle('error',err);
}

function cfg(){
return {
url:$('url').value.trim().replace(/\/+$/,''),
key:$('key').value.trim()
};
}

function valid(c){
return /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(c.url)&&/^(sb_publishable_[A-Za-z0-9_-]+|eyJ[A-Za-z0-9._-]+)$/.test(c.key);
}

function save(){
let c=cfg();
if(!valid(c)){
msg('Project URL atau publishable/anon key belum benar.',true);
return false;
}
localStorage.setItem(CK,JSON.stringify(c));
sb=window.supabase.createClient(c.url,c.key);
msg('Konfigurasi tersimpan di perangkat ini.');
return true;
}

function loadCfg(){
try{
let c=JSON.parse(localStorage.getItem(CK)||'null');
if(c){
$('url').value=c.url;
$('key').value=c.key;
if(valid(c))sb=window.supabase.createClient(c.url,c.key);
}
}catch(e){console.error(e);}
}

async function login(){
if(!sb&&!save())return;
let email=$('email').value.trim().toLowerCase();
let password=$('password').value;
if(!email||!password){
msg('Isi email dan password.',true);
return;
}
try{
let r=await sb.auth.signInWithPassword({email,password});
if(r.error)throw r.error;
user=r.data.user;
$('state').textContent='Login: '+email;
$('logout').classList.remove('hidden');
$('app').classList.remove('hidden');
await load();
}catch(e){msg('Login gagal: '+e.message,true);}
}

async function logout(){
if(sb)await sb.auth.signOut();
user=null;
$('app').classList.add('hidden');
$('logout').classList.add('hidden');
$('state').textContent='Belum login';
msg('Sudah keluar');
}

async function load(){
if(!sb||!user){
msg('Login terlebih dahulu.',true);
return;
}
try{
let [a,t]=await Promise.all([
sb.from('personal_accounts').select('*').order('created_at'),
sb.from('personal_transactions').select('*').order('transaction_date',{ascending:false}).limit(500)
]);
if(a.error)throw a.error;
if(t.error)throw t.error;
accounts=a.data||[];
tx=t.data||[];
render();
msg('Data Personal berhasil dimuat');
}catch(e){
msg('Gagal memuat data: '+e.message,true);
}
}

async function addAccount(e){
e.preventDefault();
if(!user)return msg('Login terlebih dahulu.',true);
try{
let r=await sb.from('personal_accounts').insert({
user_id:user.id,
name:$('aname').value.trim(),
account_type:$('atype').value,
opening_balance:Number($('opening').value)||0,
active:true
});
if(r.error)throw r.error;
$('af').reset();
$('opening').value=0;
await load();
}catch(x){alert('Gagal menambah akun: '+x.message);}
}

async function addTx(e){
e.preventDefault();
if(!user)return msg('Login terlebih dahulu.',true);
if(!$('account').value)return msg('Tambahkan akun terlebih dahulu.',true);
let amount=Number($('amount').value);
if(!Number.isFinite(amount)||amount<=0)return msg('Nominal harus lebih dari nol.',true);
try{
let r=await sb.from('personal_transactions').insert({
user_id:user.id,
account_id:$('account').value,
transaction_date:$('date').value,
transaction_type:$('type').value,
category:$('category').value,
amount,
note:$('note').value.trim()||null,
source:'manual',
status:'posted'
});
if(r.error)throw r.error;
$('amount').value='';
$('note').value='';
await load();
}catch(x){alert('Gagal menyimpan transaksi: '+x.message);}
}

function bal(a){
return Number(a.opening_balance||0)+tx.filter(t=>t.account_id===a.id&&t.status==='posted').reduce((s,t)=>s+(t.transaction_type==='income'?1:-1)*Number(t.amount),0);
}

function render(){
let map=new Map(accounts.map(a=>[a.id,a]));
$('account').innerHTML=accounts.map(a=>`<option value="${esc(a.id)}">${esc(a.name)}</option>`).join('')||'<option value="">Tambahkan akun dulu</option>';

$('accounts').innerHTML=accounts.map(a=>`<div class="row"><div><b>${esc(a.name)}</b><small><br>${esc(a.account_type)} · Saldo awal ${rp(a.opening_balance)}</small></div><b>${rp(bal(a))}</b></div>`).join('')||'<p class="muted">Belum ada akun.</p>';

let since=new Date();
since.setDate(since.getDate()-6);
since.setHours(0,0,0,0);

let recent=tx.filter(t=>new Date(t.transaction_date+'T00:00:00')>=since&&t.status==='posted');
let inc=recent.filter(t=>t.transaction_type==='income').reduce((s,t)=>s+Number(t.amount),0);
let out=recent.filter(t=>t.transaction_type==='expense').reduce((s,t)=>s+Number(t.amount),0);

$('balance').textContent=rp(accounts.reduce((s,a)=>s+bal(a),0));
$('income').textContent=rp(inc);
$('expense').textContent=rp(out);

$('transactions').innerHTML=tx.slice(0,40).map(t=>`<div class="row"><div><b>${esc(t.category)}</b><small><br>${esc(t.transaction_date)} · ${esc(map.get(t.account_id)?.name||'Akun')} ${t.note?'· '+esc(t.note):''}</small></div><b class="${t.transaction_type==='income'?'plus':'minus'}">${t.transaction_type==='income'?'+':'−'}${rp(t.amount)}</b></div>`).join('')||'<p class="muted">Belum ada transaksi.</p>';

let cats={};
recent.filter(t=>t.transaction_type==='expense').forEach(t=>cats[t.category]=(cats[t.category]||0)+Number(t.amount));
let top=Object.entries(cats).sort((a,b)=>b[1]-a[1])[0];

$('insights').textContent=recent.length
?`7 hari terakhir: ${recent.length} transaksi; pemasukan ${rp(inc)}, pengeluaran ${rp(out)}, selisih ${rp(inc-out)}.${top?' Pengeluaran terbesar: '+top[0]+' ('+rp(top[1])+').':''} Ini hanya data tercatat; cocokkan dengan saldo aktual.`
:'Belum ada transaksi dalam 7 hari terakhir.';
}

function init(){
if(!$('date')||!$('msg')||!$('url')||!$('key')){
console.error('Elemen HTML Personal tidak ditemukan.');
return;
}
$('date').value=new Date().toISOString().slice(0,10);
$('save').onclick=save;
$('login').onclick=login;
$('logout').onclick=logout;
$('af').addEventListener('submit',addAccount);
$('tf').addEventListener('submit',addTx);
$('refresh').onclick=load;
loadCfg();
}

if(document.readyState==='loading'){
document.addEventListener('DOMContentLoaded',init);
}else{
init();
}
})();
