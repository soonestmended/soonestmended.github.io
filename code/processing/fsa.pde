/*
* First attempt at a cellular automaton.
*/

boolean wait = false;
boolean betweenRuns = false;
int betweenTimer = 0;
boolean paused = false;
boolean cells[][];
int cellRows;
int cellCols;
float cellWidth, cellHeight;

boolean rule[];
int ruleLength = 5;
int ruleSize = (int) pow(2, ruleLength);
//(int) (log(ruleSize) / log(2));

int currentLine, lastRecordedTime, interval;

color onColor = color(255, 255, 255);
color offColor = color(40.0, 40.0, 40.0);

void setup() {
  size (512, 512);
  cellWidth = cellHeight = 4.0;
  cellRows = (int) height / (int) cellHeight;
  cellCols = (int) width / (int) cellWidth;
  cells = new boolean[cellRows][cellCols];
  rule = new boolean[ruleSize];
  interval = 0;
  lastRecordedTime = 0;
  background(1.0);

  restart();
}

void draw() {
	if (paused) return;
	if (betweenRuns) {
		if (betweenTimer < 1000) {
			betweenTimer = millis() - betweenTimerStart;
			return;
		}
		else {
			betweenTimer = 0;
			betweenRuns = false;
			restart();
			return;
		}
	}
 // for (int i = 0; i < cellRows; ++i) {
    for (int j = 0; j < cellCols; ++j) {
      if (cells[currentLine][j]) {
        fill (onColor);
      } else {
        fill (offColor);
      }
      rect(j*cellWidth, currentLine*cellHeight, cellWidth, cellHeight);
    }
 // }
  
  if (millis()-lastRecordedTime > interval) {
    iterate();
    lastRecordedTime = millis();
  }
}

void mouseClicked() {
  if (paused) {
	paused = false;
  }
  else {
	paused = true;
  }
  // restart();
}

void restart() {
  for (int j = 0; j < cellCols; ++j) {
      cells[0][j] = random(1.0) < 0.5;
  }
    
  for (int i = 1; i < cellRows; ++i) {
    for (int j = 0; j < cellCols; ++j) {
      cells[i][j] = false;
    }
  }  

  for (int i = 0; i < ruleSize; ++i) {
    rule[i] = random(1.0) < 0.5;
    // System.out.println(rule[i]);
  }
  
  currentLine = 0;
  background(1.0);
}

/*
int bitsToInt(boolean a, boolean b, boolean c) {
  return ((a ? 1 : 0) << 2) | ((b ? 1 : 0) << 1) | ((c ? 1 : 0) << 0);
}
*/

int getRule(int row, int start) {
  int result = 0;
  for (int i = 0; i < ruleLength; ++i) {
    int curCell = (int) ((start + i) % cellCols);
    if (curCell < 0) curCell += (int) cellCols;
//    System.out.println(start + " " + i + " " + cellCols + " " + curCell);
    result = result | (cells[row][curCell] ? (int) 1 : (int) 0) << (int) (ruleLength - i - 1);
  }
//println(row + " " + curCell);
//	println(result);
  return result;
}

void iterate() {
//  println(rule[2]);
currentLine++;
  if (currentLine == cellRows) { 
    	betweenRuns = true;
	betweenTimerStart = millis();
	return;
  }
  //System.out.println("Current line: " + currentLine);

  for (int j = 0; j < cellCols; ++j) {
    int ruleIndex = getRule(currentLine - 1, j - (int) (ruleLength / 2));
    cells[currentLine][j] = rule[ruleIndex];
  }
}
