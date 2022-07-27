function partition(splitAxis, tris, triIndices, low, high) {
    let pivot = tris[triIndices[high]];
    let i = low - 1;
    for (let j = low; j <= high - 1; j++) {
        let tri = tris[triIndices[j]];
        if (tri.bbox.centroid[splitAxis] <= pivot.bbox.centroid[splitAxis]) {
            i++;
            let tmp = triIndices[j];
            triIndices[j] = triIndices[i];
            triIndices[i] = tmp;
        }
    }
    let tmp = triIndices[i+1];
    triIndices[i+1] = triIndices[high];
    triIndices[high] = tmp;
    return (i+1);
}

function sortAlongAxis(splitAxis, tris, triIndices, low, high) {
    // quicksort allTris array along axis <splitAxis> 
    if (low < high) {
        let pi = partition(splitAxis, tris, triIndices, low, high);
        sortAlongAxis(splitAxis, tris, triIndices, low, pi - 1);
        sortAlongAxis(splitAxis, tris, triIndices, pi+1, high);
    }
}

function saaInsertion(splitAxis, tris, triIndices, low, high) {
    for (let i = low; i < high; i++) {
        let j = i;
        while (j > 0 && tris[triIndices[j-1]].bbox.centroid[splitAxis] > tris[triIndices[j]].bbox.centroid[splitAxis]) {
            let tmp = triIndices[j];
            triIndices[j] = triIndices[j-1];
            triIndices[j-1] = tmp;
            j--;
        }
    }
}

function saaIterative(splitAxis, tris, triIndices, low, high) {
    let stack = new Int32Array(high-low+1);
    let top = -1;
    stack[++top] = low;
    stack[++top] = high;
    while (top >= 0) {
        high = stack[top--];
        low = stack[top--];
        let p = partition(splitAxis, tris, triIndices, low, high);
        if (p-1 > low) {
            stack[++top] = low;
            stack[++top] = p - 1;
        }

        if (p+1 < high) {
            stack[++top] = p + 1;
            stack[++top] = high;
        }
    }
}

var numNodes = 1;

class BVHNode {
    constructor(start, num, bbox) {
        this.isLeaf = true;
        this.isNear = false;
        this.start = start;
        this.num = num;
        this.left = null;
        this.right = null;
        this.bbox = new BBox(bbox.min, bbox.max);
        this.splitAxis = -1;
        this.skip = null;
        this.id = 0;
        this.parentID = 0;
        this.siblingID = 0;
    }

    split(allTris, triIndices) {
        // if we have fewer than N triangles, stop
        if (this.num < 4) {
            return;
        }

        // find splitting plane

        let bestSplitCost = Number.MAX_SAFE_INTEGER;
        let splitIndex, bestLeftBBoxIndex;
        let bestLeftBBox, bestRightBBox, bestRightBBoxRange;
        let sortedIndices = [new Int32Array(this.num), new Int32Array(this.num), new Int32Array(this.num)];
        let blbbMin, blbbMax;
        for (let axis = 0; axis < 3; axis++) {

            // sort in place by centroid[splitAxis]
            //sortAlongAxis(this.splitAxis, allTris, this.start, this.start+this.num-1);
            // initialize sorted indices for this axis
            for (let i = this.start; i < this.start+this.num; i++) 
                sortedIndices[axis][i-this.start] = triIndices[i];

            if (this.num > 10)
                saaIterative(axis, allTris, sortedIndices[axis], 0, this.num-1); //this.start, this.start+this.num-1);
            else 
                saaInsertion(axis, allTris, sortedIndices[axis], 0, this.num-1); //this.start, this.start+this.num-1);


            // sweep centroids from left to right, calculating cost of splitting at each place
            // (first pass just use middle centroid as split)
            let leftBBoxes = new Float32Array(6*this.num);
            let leftBBoxAreas = new Float32Array(this.num);
            let growingLeftBBox = new BBox([999999, 999999, 999999], [-999999, -999999, -999999]);

            for (let i = this.start; i < this.start + this.num - 1; i++) {
                // compute cost of splitting at triangle # triIndices[i]
                // add current triangle to bbox
                growingLeftBBox.expand(allTris[sortedIndices[axis][i-this.start]].bbox);

                // store current bbox in list
                leftBBoxes[6*(i-this.start)] = growingLeftBBox.min[0];
                leftBBoxes[6*(i-this.start)+1] = growingLeftBBox.min[1];
                leftBBoxes[6*(i-this.start)+2] = growingLeftBBox.min[2];
                leftBBoxes[6*(i-this.start)+3] = growingLeftBBox.max[0];
                leftBBoxes[6*(i-this.start)+4] = growingLeftBBox.max[1];
                leftBBoxes[6*(i-this.start)+5] = growingLeftBBox.max[2];

                leftBBoxAreas[i-this.start] = growingLeftBBox.surfaceArea();

            }

            // now sweep from right, completing the SAH calculation
            let growingRightBBox = new BBox([999999, 999999, 999999], [-999999, -999999, -999999]);
            let trisInLeftBBox = this.num-1; // start with 1 tri in right bbox


            for (let i = this.start+this.num-1; i > this.start; i--) {
                growingRightBBox.expand(allTris[sortedIndices[axis][i-this.start]].bbox);

                let splitCost = trisInLeftBBox * leftBBoxAreas[i-1-this.start] + (this.num - trisInLeftBBox) * growingRightBBox.surfaceArea();
                if (splitCost < bestSplitCost) {
                //if (i - 1 == this.start + Math.floor(this.num/2)) {
                    bestSplitCost = splitCost;
                    splitIndex = i-1;
                    this.splitAxis = axis;
                    bestLeftBBoxIndex = i-1-this.start; //].min, leftBBoxes[i-1-this.start].max];
                    bestRightBBoxRange = [growingRightBBox.min.slice(), growingRightBBox.max.slice()];
                    blbbMin = [leftBBoxes[6*(bestLeftBBoxIndex)], leftBBoxes[6*(bestLeftBBoxIndex)+1], leftBBoxes[6*(bestLeftBBoxIndex)+2]];
                    blbbMax = [leftBBoxes[6*(bestLeftBBoxIndex)+3], leftBBoxes[6*(bestLeftBBoxIndex)+4], leftBBoxes[6*(bestLeftBBoxIndex)+5]];
                }
                trisInLeftBBox--;
            }
        }

        // copy sorted indices from correct axis back to triIndices
        for (let i = 0; i < this.num; i++) {
            triIndices[i+this.start] = sortedIndices[this.splitAxis][i];
        }

        console.log("BSC: " + bestSplitCost);

        bestLeftBBox = new BBox(blbbMin, blbbMax);
        bestRightBBox = new BBox(bestRightBBoxRange[0], bestRightBBoxRange[1]);

        // split happens just to the right of the index
       //let splitIndex = this.start + Math.floor(this.num/2);

        // ranges covered by child nodes
        let leftStart = this.start;
        let leftNum = splitIndex - leftStart + 1;
        let rightStart = leftStart + leftNum;
        let rightNum = this.num - leftNum;
/*
        // make bboxes for children
        let leftBBox = new BBox([999999, 999999, 999999], [-999999, -999999, -999999]);
        let rightBBox = new BBox([999999, 999999, 999999], [-999999, -999999, -999999]);

        // expand them with their triangles
        for (let i = leftStart; i < leftStart + leftNum; i++) {
            leftBBox.expand(allTris[triIndices[i]].bbox);
        }
        for (let i = rightStart; i < rightStart + rightNum; i++) {
            rightBBox.expand(allTris[triIndices[i]].bbox);
        }
*/

        this.left = new BVHNode(leftStart, leftNum, bestLeftBBox);
        this.right = new BVHNode(rightStart, rightNum, bestRightBBox);
        
        this.left.skip = this.right;
        this.left.id = numNodes++;
        this.left.isNear = true;
        this.left.parentID = this.id;
        this.left.siblingID = this.right.id;
        this.left.split(allTris, triIndices);

        this.right.skip = this.skip;
        this.right.id = numNodes++;
        this.right.isNear = false;
        this.right.parentID = this.id;
        this.right.siblingID = this.left.id;
        this.right.split(allTris, triIndices);
        
        this.isLeaf = false;
        this.start = -1;
        this.num = -1;

    }
}