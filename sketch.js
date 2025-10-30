let table;
let questions = [];
let current = 0;
let score = 0;
let w, h;
let options = [];
let selected = -1;
let feedbackTimer = 0;
let state = 'quiz'; // 'quiz' or 'result'
let resultsAnim = null;
let cursorPos = {x:0,y:0};
let pulse = 0;

// layout & responsive
let qBox = { x:16, y:64, w:0, h:0 };
let scaleFactor = 1;

function preload() {
	// 請確保 questions.csv 與此檔案同目錄
	table = loadTable('questions.csv', 'csv', 'header');
}

function setup() {
	w = min(windowWidth, 900);
	h = floor(w * 0.65);
	let cnv = createCanvas(w, h);
	cnv.parent('app');
	noCursor();
	parseQuestions();
	textFont('Arial');
	setupLayouts();
	// 產生第一題的隨機順序
	generateShuffledOptions(current);
}

function windowResized(){
	w = min(windowWidth, 900);
	h = floor(w * 0.65);
	resizeCanvas(w,h);
	setupLayouts();
}

function parseQuestions(){
	for (let r=0; r<table.getRowCount(); r++){
		let row = table.getRow(r);
		let ans = row.get('answer').trim().toUpperCase();
		let correctIdx = ['A','B','C','D'].indexOf(ans);
		questions.push({
			q: row.get('question'),
			opts: [row.get('optionA'), row.get('optionB'), row.get('optionC'), row.get('optionD')],
			answer: ans,
			correctIndex: correctIdx,
			order: [0,1,2,3] // will be shuffled when shown
		});
	}
}

function setupLayouts(){
	// 計算縮放比例（以 900 為基準）
	scaleFactor = w / 900;
	if (scaleFactor < 0.6) scaleFactor = 0.6;

	// 題目區塊：靠左、扁平高度，避免與選項重疊
	qBox.x = 16;
	qBox.y = 64;
	qBox.w = w - 32;
	// 根據高度與縮放決定題目區塊高度（較短以避免 overlap）
	qBox.h = max(84 * scaleFactor, floor(h * 0.18));

	// 選項排列：窄螢幕單欄，寬螢幕兩欄
	options = [];
	let padding = 16 * scaleFactor;
	let cols = (w < 520) ? 1 : 2;
	let boxW = (w - padding*(cols+1)) / cols;
	let boxH = max(48 * scaleFactor, floor(qBox.h * 0.6));
	let startY = qBox.y + qBox.h + 16 * scaleFactor;
	for (let i=0;i<4;i++){
		let col = i % cols;
		let row = floor(i / cols);
		let x = padding + col * (boxW + padding);
		let y = startY + row * (boxH + 12 * scaleFactor);
		options.push({x,y,w:boxW,h:boxH});
	}
}

function draw(){
	background(246,250,255);
	drawHeader();
	if (state === 'quiz') {
		drawQuestion();
	} else {
		drawResult();
	}
	drawCustomCursor();
	if (feedbackTimer>0) {
		feedbackTimer--;
	}
	pulse = sin(frameCount*0.25)*0.06 + 1;
}

function drawHeader(){
	fill(30);
	noStroke();
	textSize(20 * scaleFactor);
	textAlign(LEFT, TOP);
	text("測驗系統", 18, 12);
	textSize(13 * scaleFactor);
	fill(90);
	text(`題目 ${min(current+1, questions.length)}/${questions.length}`, 18, 38);
	textAlign(RIGHT, TOP);
	text(`分數：${score}`, w-18, 12);
}

function drawQuestion(){
	if (!questions[current]) return;
	let item = questions[current];
	// 題目區塊（靠左，文字改為靠上並微調上邊距）
	push();
	fill(255);
	stroke(200);
	rect(qBox.x, qBox.y, qBox.w, qBox.h, 12);
	noStroke();
	fill(20);
	textSize(18 * scaleFactor);
	textLeading(24 * scaleFactor);
	// 改為靠上對齊並微調 y 座標（上方內邊距）
	textAlign(LEFT, TOP);
	let txtX = qBox.x + 16 * scaleFactor;
	let txtY = qBox.y + 8 * scaleFactor; // 往上移一點：可從 12 調整到 8
	let txtW = qBox.w - 32 * scaleFactor;
	text(item.q, txtX, txtY, txtW);
	pop();

	// 選項（依照 item.order 顯示）
	for (let i=0;i<4;i++){
		let optGeom = options[i];
		// 若螢幕太小可能只有 3 或 4 個位置，確保存在
		if (!optGeom) continue;
		let origIdx = item.order[i];
		let isHover = mouseX > optGeom.x && mouseX < optGeom.x+optGeom.w && mouseY > optGeom.y && mouseY < optGeom.y+optGeom.h;
		let bg = color(255);
		let strokeCol = color(200);
		if (selected===i) {
			// 被選中的選項，顯示答對答錯（以原始正確索引判斷）
			let isCorrect = (origIdx === item.correctIndex);
			bg = lerpColor(color(255), isCorrect?color(200,255,200):color(255,200,200), 0.6);
			strokeCol = isCorrect?color(50,180,50):color(200,50,50);
		} else if (isHover) {
			bg = color(245,252,255);
			strokeCol = color(120,190,255);
		}
		// 選取動畫 scale
		push();
		translate(optGeom.x+optGeom.w/2, optGeom.y+optGeom.h/2);
		let s = (selected===i)?(1.03*pulse): (isHover?1.02:1);
		scale(s);
		translate(-optGeom.x-optGeom.w/2, -optGeom.y-optGeom.h/2);
		fill(bg);
		stroke(strokeCol);
		strokeWeight(1.5);
		rect(optGeom.x, optGeom.y, optGeom.w, optGeom.h, 10);
		noStroke();
		fill(30);
		textSize(14 * scaleFactor);
		textAlign(LEFT, CENTER);
		// 顯示選項字元 A. B. C. D.（對使用者不變，但對應的內容已被打亂）
		let letter = ['A','B','C','D'][i];
		text(letter + ".  " + item.opts[origIdx], optGeom.x + 12 * scaleFactor, optGeom.y + optGeom.h/2);
		pop();
	}

	// 點選提示
	if (selected===-1){
		fill(100);
		textSize(12 * scaleFactor);
		textAlign(LEFT, BOTTOM);
		text("請點選一個選項", 18, h-14);
	}
}

function mouseMoved(){
	cursorPos.x = mouseX;
	cursorPos.y = mouseY;
}

function mousePressed(){
	if (state !== 'quiz') return;
	for (let i=0;i<options.length;i++){
		let opt = options[i];
		if (!opt) continue;
		if (mouseX > opt.x && mouseX < opt.x+opt.w && mouseY > opt.y && mouseY < opt.y+opt.h){
			handleSelection(i);
		}
	}
}

function handleSelection(i){
	if (selected !== -1) return; // 已選過
	selected = i;
	let item = questions[current];
	let origIdx = item.order[i]; // 對應回原始選項索引
	let correct = (origIdx === item.correctIndex);
	if (correct) score++;
	feedbackTimer = 40; // 短暫停留
	// 等待短暫時間後前往下一題或結果
	setTimeout(()=>{
		current++;
		selected = -1;
		if (current >= questions.length){
			state = 'result';
			spawnResultAnimation();
		} else {
			// 為下一題產生新的隨機順序並重新布局（保證選項位置也適應）
			generateShuffledOptions(current);
			setupLayouts();
		}
	}, 700);
}

function generateShuffledOptions(qIdx){
	if (!questions[qIdx]) return;
	let arr = [0,1,2,3];
	// Fisher-Yates shuffle
	for (let i = arr.length - 1; i > 0; i--) {
		let j = floor(random(i + 1));
		let tmp = arr[i];
		arr[i] = arr[j];
		arr[j] = tmp;
	}
	questions[qIdx].order = arr;
}

function spawnResultAnimation(){
	let pct = score / questions.length;
	if (pct >= 0.8){
		resultsAnim = new ConfettiAnim();
	} else if (pct >= 0.5){
		resultsAnim = new StarAnim();
	} else {
		resultsAnim = new BalloonAnim();
	}
}

function drawResult(){
	// 顯示總結資訊
	background(250,250,255);
	fill(20);
	textSize(26 * scaleFactor);
	textAlign(CENTER, TOP);
	text("測驗完成", w/2, 36);
	textSize(18 * scaleFactor);
	text(`總分 ${score} / ${questions.length}`, w/2, 78);

	// 動畫繪製
	if (resultsAnim) resultsAnim.updateAndDraw();

	// 重新開始按鈕
	let bx = w/2 - 80, by = h - 90, bw=160, bh=48;
	fill(255);
	stroke(60);
	rect(bx,by,bw,bh,10);
	noStroke();
	fill(60);
	textSize(16 * scaleFactor);
	textAlign(CENTER, CENTER);
	text("重新開始", w/2, by+bh/2);
	// 按鈕互動
	if (mouseIsPressed && mouseX>bx && mouseX<bx+bw && mouseY>by && mouseY<by+bh){
		resetQuiz();
	}
}

function resetQuiz(){
	current = 0;
	score = 0;
	state = 'quiz';
	resultsAnim = null;
	generateShuffledOptions(current);
	setupLayouts();
}

// --- custom cursor & small effects ---
function drawCustomCursor(){
	// 拖尾圓
	noStroke();
	fill(20,120,255,140);
	ellipse(cursorPos.x, cursorPos.y, 18 + sin(frameCount*0.3)*4, 18 + cos(frameCount*0.3)*4);
	// 指示點
	fill(255);
	ellipse(cursorPos.x, cursorPos.y, 6);
}

// --- 結果動畫類別 ---
class ConfettiAnim {
	constructor(){
		this.pieces = [];
		for (let i=0;i<120;i++){
			this.pieces.push({
				x: random(w),
				y: random(-h,0),
				vx: random(-1,1),
				vy: random(1,4),
				col: color(random(255),random(255),random(255)),
				r: random(6,14),
				rot: random(TWO_PI),
				vr: random(-0.1,0.1)
			});
		}
	}
	updateAndDraw(){
		for (let p of this.pieces){
			p.x += p.vx;
			p.y += p.vy;
			p.vy += 0.03;
			p.rot += p.vr;
			push();
			translate(p.x,p.y);
			rotate(p.rot);
			fill(p.col);
			noStroke();
			rect(0,0,p.r,p.r/2);
			pop();
			if (p.y > h+40) {
				p.y = random(-h,0);
				p.x = random(w);
				p.vy = random(1,3);
			}
		}
		// 讚美文字
		fill(40,160,80);
		textSize(22 * scaleFactor);
		textAlign(CENTER, CENTER);
		text("太棒了！你表現優異 🎉", w/2, h*0.55);
	}
}

class StarAnim {
	constructor(){
		this.stars = [];
		for (let i=0;i<60;i++){
			this.stars.push({x:random(w), y:random(h/2), r:random(2,6), a:random(), vm:random(0.002,0.01)});
		}
	}
	updateAndDraw(){
		for (let s of this.stars){
			s.a += s.vm;
			let a = 0.5 + 0.5*sin(s.a*PI*2);
			noStroke();
			fill(255,220,80, 200*a);
			ellipse(s.x, s.y, s.r + 4*a);
		}
		fill(50,80,220);
		textSize(20 * scaleFactor);
		textAlign(CENTER, CENTER);
		text("不錯喔，繼續進步！", w/2, h*0.6);
	}
}

class BalloonAnim {
	constructor(){
		this.balloons = [];
		for (let i=0;i<8;i++){
			this.balloons.push({x: random(w*0.1,w*0.9), y: random(h*0.6,h+40), vy: random(0.3,1), col: color(random(255),random(255),random(255))});
		}
	}
	updateAndDraw(){
		for (let b of this.balloons){
			b.y -= b.vy;
			noStroke();
			fill(b.col);
			ellipse(b.x, b.y, 36,46);
			fill(150,100);
			rect(b.x-1, b.y+23, 2, 18);
			if (b.y < -40) {
				b.y = random(h+20, h+200);
				b.x = random(w*0.1,w*0.9);
			}
		}
		fill(100,20,140);
		textSize(20 * scaleFactor);
		textAlign(CENTER, CENTER);
		text("加油！下次會更好 😊", w/2, h*0.55);
	}
}
