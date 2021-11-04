var numMaterials = 0;

const PURE_DIFFUSE = 0.0;
const MIRROR = 1.0;
const GLASS = 2.0;
const DIELECTRIC = 3.0;
const CONDUCTOR = 4.0;
const OREN_NAYAR = 5.0;
const DIFFUSE_SPEC_SHIRLEY = 6.0;



class Material {
  constructor(options) {
    if (options === undefined) options = {};
    if (options.diffuse === undefined) {
        options.diffuse = [0, 0, 0];
    }
    if (options.specular === undefined) {
        options.specular = [0, 0, 0];
    }
    if (options.transmission === undefined) {
        options.transmission = [0, 0, 0];
    }
    if (options.emission === undefined) {
        options.emission = [0, 0, 0];
    }
    if (options.type === undefined) {
      options.type = PURE_DIFFUSE;
    }
    if (options.type == OREN_NAYAR) {
      let sigma2 = options.sigma * options.sigma;
      this.A = 1.0 - (sigma2 / (2.0 * (sigma2 + .33)));
      this.B = 0.45 * sigma2 / (sigma2 + .09);
    }
    if (options.type == GLASS) {
      this.eta = options.eta;
    }
    if (options.type == CONDUCTOR) {
      this.alpha = options.alpha;
      options.specular = options.k;
      options.transmission = options.eta;
    }
    this.diffuse = options.diffuse;
    this.specular = options.specular;
    this.transmission = options.transmission;
    this.emission = options.emission;
    this.type = options.type;
    this.ID = numMaterials++;
  }
}

class Light {
  constructor(tri, color) {
    this.tri = tri;
    this.color = color;
    this.area = tri.area();
  }

}

class BBox {
    constructor(bbmin, bbmax) {
        this.min = bbmin.slice();
        this.max = bbmax.slice();
        this.centroid = [0.5*(bbmax[0]+bbmin[0]), 0.5*(bbmax[1]+bbmin[1]), 0.5*(bbmax[2]+bbmin[2])];
    }

    expand(bbox) {
        for (let i = 0; i < 3; i++) {
            this.min[i] = Math.min(this.min[i], bbox.min[i]);
            this.max[i] = Math.max(this.max[i], bbox.max[i]);
        }
        this.updateCentroid();
    }

    updateCentroid() {
        this.centroid = [0.5*(this.max[0]+this.min[0]), 0.5*(this.max[1]+this.min[1]), 0.5*(this.max[2]+this.min[2])];
    }

    overlapTriangle(tri) {
        // for now, just test whether BBoxes overlap
        for (let i = 0; i < 3; i++) {
            let hws = (this.centroid[i] - this.min[i]) + (tri.bbox.centroid[i] - tri.bbox.min[i]); // HalfWidthS
            if (Math.abs(this.centroid[i] - tri.bbox.centroid[i]) >= hws) return false;
        }
        return true;
    }

    surfaceArea() {
      let l = [this.max[0] - this.min[0], this.max[1] - this.min[1], this.max[2] - this.min[2]];
      return 2.0 * (l[0] * l[1] + l[1] * l[2] + l[2] * l[0]);
    }
}

class Triangle {
  constructor(p, q, r, np, nq, nr, uvp, uvq, uvr, material) {
    this.p = p;
    this.q = q;
    this.r = r;
    
    this.np = np;
    this.nq = nq;
    this.nr = nr;

    this.uvp = uvp;
    this.uvq = uvq;
    this.uvr = uvr;

    this.material = material;
    let bbmin = [Math.min(p[0], q[0], r[0]), Math.min(p[1], q[1], r[1]), Math.min(p[2], q[2], r[2])];
    let bbmax = [Math.max(p[0], q[0], r[0]), Math.max(p[1], q[1], r[1]), Math.max(p[2], q[2], r[2])];
    this.bbox = new BBox(bbmin, bbmax);
  }

  toTriangles() {
    return [this];
  }

  numTriangles() {
    return 1;
  }

  area() {
    let a = v3.distance(this.p, this.q);
    let b = v3.distance(this.q, this.r);
    let c = v3.distance(this.r, this.p);
    let s = (a+b+c) * .5;
    return Math.sqrt(s*(s-a)*(s-b)*(s-c));
  }
}

class Mesh {
  constructor(vertices, normals, texCoords, material) {
    let v3 = twgl.v3;
    // vertices is individual floats -- so each triangle is 9 elements in vertices array
    if (vertices instanceof Float32Array) {
      this.vertices = vertices;
    }
    else {
      this.vertices = new Float32Array(vertices);
    }
    if (!normals) {
      this.normals = new Float32Array(vertices.length);
      for (let i = 0; i < vertices.length; i+=9) {
        let p = v3.create(vertices[i], vertices[i+1], vertices[i+2]);
        let q = v3.create(vertices[3+i], vertices[3+i+1], vertices[3+i+2]);
        let r = v3.create(vertices[6+i], vertices[6+i+1], vertices[6+i+2]);
        let e1 = v3.subtract(q, p);
        let e2 = v3.subtract(r, p);
        let n = v3.create(e1[1]*e2[2] - e1[2]*e2[1], e1[2]*e2[0] - e1[0]*e2[2], e1[0]*e2[1]-e1[1]*e2[0]);
        let l = Math.sqrt(n[0]*n[0]+n[1]*n[1]+n[2]*n[2]);
        for (let j = i; j < i+9; j+=3) {
          this.normals[j] = n[0]/l;
          this.normals[j+1] = n[1]/l;
          this.normals[j+2] = n[2]/l;
        }
      }
    }
    else {
      if (normals instanceof Float32Array) {
        this.normals = normals;
      }
      else {
        this.normals = new Float32Array(normals);
      }
    }
    if (!texCoords) {
      let nTexCoords = Math.floor(2*vertices.length/3);
      this.texCoords = new Float32Array(nTexCoords);
      for (let i = 0; i < nTexCoords; i++) {
        this.texCoords[i] = 0.0;
      }
    }
    else {
      if (texCoords instanceof Float32Array) {
        this.texCoords = texCoords;
      }
      else {
        this.texCoords = new Float32Array(texCoords);
      }
    }

    this.material = material;
    this.updateBBox();
  }

  updateBBox() {
    let min = [99999, 99999, 99999];
    let max = [-99999, -99999, -99999];

    for (let i = 0; i < this.vertices.length; i+=3) {
        for (let j = 0; j < 3; j++) {
            if (this.vertices[i+j] < min[j]) {
                min[j] = this.vertices[i+j];
            }
            if (this.vertices[i+j] > max[j]) {
                max[j] = this.vertices[i+j];
            }
        }
    }
    this.bbox = new BBox(min, max);
  }

  rotate(axis, angle) {
    let m = m4.axisRotation(axis, angle);
    for (let i = 0; i < this.vertices.length; i+=3) {
      const v0 = this.vertices[i];
      const v1 = this.vertices[i+1];
      const v2 = this.vertices[i+2];
      const d = v0 * m[0 * 4 + 3] + v1 * m[1 * 4 + 3] + v2 * m[2 * 4 + 3] + m[3 * 4 + 3];
      this.vertices[i]   = (v0 * m[0 * 4 + 0] + v1 * m[1 * 4 + 0] + v2 * m[2 * 4 + 0] + m[3 * 4 + 0]) / d;
      this.vertices[i+1] = (v0 * m[0 * 4 + 1] + v1 * m[1 * 4 + 1] + v2 * m[2 * 4 + 1] + m[3 * 4 + 1]) / d;
      this.vertices[i+2] = (v0 * m[0 * 4 + 2] + v1 * m[1 * 4 + 2] + v2 * m[2 * 4 + 2] + m[3 * 4 + 2]) / d;
    }
    const mi = m4.inverse(m);
    for (let i = 0; i < this.normals.length; i+=3) {
      const v0 = this.normals[i];
      const v1 = this.normals[i+1];
      const v2 = this.normals[i+2];

      this.normals[i]   = v0 * mi[0 * 4 + 0] + v1 * mi[0 * 4 + 1] + v2 * mi[0 * 4 + 2];
      this.normals[i+1] = v0 * mi[1 * 4 + 0] + v1 * mi[1 * 4 + 1] + v2 * mi[1 * 4 + 2];
      this.normals[i+2] = v0 * mi[2 * 4 + 0] + v1 * mi[2 * 4 + 1] + v2 * mi[2 * 4 + 2];
    }
    this.updateBBox();
  }

  scaleTo(outputSize) {
    let inputSize = Math.max(this.bbox.max[0] - this.bbox.min[0], this.bbox.max[1] - this.bbox.min[1], this.bbox.max[2] - this.bbox.min[2]);
    let scale = outputSize / inputSize;
    for (let i = 0; i < this.vertices.length; i++) 
      this.vertices[i] *= scale;
    for (let i = 0; i < 3; i++) {
      this.bbox.min[i] *= scale;
      this.bbox.max[i] *= scale;
    }
    this.bbox.updateCentroid();
  }

  translateTo(newCenter) {
    let dXYZ = [newCenter[0] - this.bbox.centroid[0], newCenter[1] - this.bbox.centroid[1], newCenter[2] - this.bbox.centroid[2]];
    for (let i = 0; i < this.vertices.length; i+=3) {
      this.vertices[i] += dXYZ[0];
      this.vertices[i+1] += dXYZ[1];
      this.vertices[i+2] += dXYZ[2];
    }
    for (let i = 0; i < 3; i++) {
      this.bbox.min[i] += dXYZ[i];
      this.bbox.max[i] += dXYZ[i];
    }
    this.bbox.updateCentroid();
  }

  toTriangles() {
    var ans = [];
    for (let face = 0; face < this.vertices.length / 9; face++) {
      let pi = face * 9;
      let ti = face * 6;
      ans.push(new Triangle([this.vertices[pi],     this.vertices[pi+1],  this.vertices[pi+2]],
                            [this.vertices[pi+3],   this.vertices[pi+4],  this.vertices[pi+5]],
                            [this.vertices[pi+6],   this.vertices[pi+7],  this.vertices[pi+8]],

                            [this.normals[pi],      this.normals[pi+1],   this.normals[pi+2]],
                            [this.normals[pi+3],    this.normals[pi+4],   this.normals[pi+5]],
                            [this.normals[pi+6],    this.normals[pi+7],   this.normals[pi+8]],

                            [this.texCoords[ti],    this.texCoords[ti+1]], 
                            [this.texCoords[ti+2],  this.texCoords[ti+3]],
                            [this.texCoords[ti+4],  this.texCoords[ti+5]],

                            this.material));
    }
    return ans;
  }

  numTriangles() {
      return this.vertices.length / 9;
  }

  static readVerticesFromPLY(plyText) {
    let lines = plyText.split("\n");
    let numVertices, numFaces;
    let vertices, faces, normals;
    let currentVertex = 0;
    let currentFace = 0;
    let inHeader = true;
    let hasNormals = false;
    for (let i = 0; i < lines.length; i++) {
      let l = lines[i];
      if (inHeader) {
        if (l.startsWith("element")) {
          let tokens = l.split(" ");
          if (tokens[1].startsWith("vertex")) {
            numVertices = Number.parseInt(tokens[2], 10);
            vertices = new Float32Array(3*numVertices);
            normals = new Float32Array(3*numVertices);
          }
          else if (tokens[1].startsWith("face")) {
            numFaces = Number.parseInt(tokens[2], 10);
            faces = new Int32Array(3*numFaces)
          }
        }
        else if (l.startsWith("property")) {
          let tokens = l.split(" ");
          if (tokens[2].startsWith("nx")) {
            hasNormals = true; 
          }
        }
      
        else if (l.startsWith("end_header")) {
          inHeader = false;
        }
      }
      else {
        let tokens = l.split(" ");

        if (currentVertex < numVertices) {
          vertices[3*currentVertex] =   Number.parseFloat(tokens[0]);
          vertices[3*currentVertex+1] = Number.parseFloat(tokens[1]);
          vertices[3*currentVertex+2] = Number.parseFloat(tokens[2]);
          if (hasNormals) {
            normals[3*currentVertex] =   Number.parseFloat(tokens[3]);
            normals[3*currentVertex+1] = Number.parseFloat(tokens[4]);
            normals[3*currentVertex+2] = Number.parseFloat(tokens[5]);
          }
          currentVertex++;
        }
        else if (currentFace < numFaces) {
          faces[3*currentFace] = Number.parseInt(tokens[1], 10);
          faces[3*currentFace+1] = Number.parseInt(tokens[2], 10);
          faces[3*currentFace+2] = Number.parseInt(tokens[3], 10);
          currentFace++;
        }
      }
    }
    let outputVertices = new Float32Array(numFaces*9);
    let outputNormals = new Float32Array(numFaces*9);
    //}
    //else {
      //outputNormals = null;
    //}
   
    for (let i = 0; i < numFaces; i++) {
      let v0i = faces[3*i];
      let v1i = faces[3*i+1];
      let v2i = faces[3*i+2];

      outputVertices[i*9] = vertices[3*v0i];
      outputVertices[i*9+1] = vertices[3*v0i+1];
      outputVertices[i*9+2] = vertices[3*v0i+2];

      outputVertices[i*9+3] = vertices[3*v1i];
      outputVertices[i*9+4] = vertices[3*v1i+1];
      outputVertices[i*9+5] = vertices[3*v1i+2];

      outputVertices[i*9+6] = vertices[3*v2i];
      outputVertices[i*9+7] = vertices[3*v2i+1];
      outputVertices[i*9+8] = vertices[3*v2i+2];

      if (hasNormals) {
        outputNormals[i*9] = normals[3*v0i];
        outputNormals[i*9+1] = normals[3*v0i+1];
        outputNormals[i*9+2] = normals[3*v0i+2];

        outputNormals[i*9+3] = normals[3*v1i];
        outputNormals[i*9+4] = normals[3*v1i+1];
        outputNormals[i*9+5] = normals[3*v1i+2];

        outputNormals[i*9+6] = normals[3*v2i];
        outputNormals[i*9+7] = normals[3*v2i+1];
        outputNormals[i*9+8] = normals[3*v2i+2];
      }
      // add code for normal smoothing here -- keep table of accumulated normals for each vertex
      else {
        let p = v3.create(vertices[3*v0i], vertices[3*v0i+1], vertices[3*v0i+2]);
        let q = v3.create(vertices[3*v1i], vertices[3*v1i+1], vertices[3*v1i+2]);
        let r = v3.create(vertices[3*v2i], vertices[3*v2i+1], vertices[3*v2i+2]);
        let e1 = v3.subtract(q, p);
        let e2 = v3.subtract(r, p);
        let n = v3.create(e1[1]*e2[2] - e1[2]*e2[1], e1[2]*e2[0] - e1[0]*e2[2], e1[0]*e2[1]-e1[1]*e2[0]);
        let l = Math.sqrt(n[0]*n[0]+n[1]*n[1]+n[2]*n[2]);
        for (let i = 0; i < 3; i++) {
          normals[v0i*3+i] += n[i]/l;
          normals[v1i*3+i] += n[i]/l;
          normals[v2i*3+i] += n[i]/l;
        }
      }
    }

    if (!hasNormals) {
      // at this point, normals (of length 3*numVertices) has accumulated normals for each face the vertex participates in
      // need to first normalize all of these

      for (let i = 0; i < numVertices; i++) {
        let x = normals[i*3];
        let y = normals[i*3+1];
        let z = normals[i*3+2];
        let l = Math.sqrt(x*x+y*y+z*z);
        normals[i*3] = x/l;
        normals[i*3+1] = y/l;
        normals[i*3+2] = z/l;
      }

      // then loop over the faces again and store these normals in outputNormals
      for (let i = 0; i < numFaces; i++) {
        let v0i = faces[3*i];
        let v1i = faces[3*i+1];
        let v2i = faces[3*i+2];

        outputNormals[i*9] = normals[3*v0i];
        outputNormals[i*9+1] = normals[3*v0i+1];
        outputNormals[i*9+2] = normals[3*v0i+2];

        outputNormals[i*9+3] = normals[3*v1i];
        outputNormals[i*9+4] = normals[3*v1i+1];
        outputNormals[i*9+5] = normals[3*v1i+2];

        outputNormals[i*9+6] = normals[3*v2i];
        outputNormals[i*9+7] = normals[3*v2i+1];
        outputNormals[i*9+8] = normals[3*v2i+2];
      }
    }

    return {outputVertices, outputNormals}; //new Mesh(outputVertices, 0, 0, new Material({diffuse: [.3, .3, .8]}));

  }
}

class Sphere {
    constructor(center, radius, material, depth) {
        this.center = v3.create(center[0], center[1], center[2]);
        this.radius = radius;
        this.material = material;
        this.depth = depth;
        let X = .525731112119133606;// * radius;
        let Z = .850650808352039932;// * radius;
        this.vertices = [
            v3.create(-X, 0, Z), 
            v3.create(X, 0, Z),
            v3.create(-X, 0, -Z),
            v3.create(X, 0, -Z),
            v3.create(0, Z, X),
            v3.create(0, Z, -X),
            v3.create(0, -Z, X),
            v3.create(0, -Z, -X),
            v3.create(Z, X, 0),
            v3.create(-Z, X, 0),
            v3.create(Z, -X, 0),
            v3.create(-Z, -X, 0),
        ];
        

        this.faces = [
            [0, 4, 1], [0, 9, 4], [9, 5, 4], [4, 5, 8], [4, 8, 1],
            [8, 10, 1], [8, 3, 10], [5, 3, 8], [5, 2, 3], [2, 7, 3],
            [7, 10, 3], [7, 6, 10], [7, 11, 6], [11, 0, 6], [0, 1, 6],
            [6, 1, 10], [9, 0, 11], [9, 11, 2], [9, 2, 5], [7, 2, 11]
        ];
        this.bbox = new BBox([this.center[0]-radius, this.center[1]-radius, this.center[2]-radius], [this.center[0]+radius, this.center[1]+radius, this.center[2]+radius]);
    }

    toTriangles() {
        let verts = [];
        for (let i = 0; i < this.faces.length; i++) {
            let f = this.faces[i];
            verts.push([this.vertices[f[0]], this.vertices[f[1]], this.vertices[f[2]]]);
//            let n = [];
//            for (let j = 0; j < 3; j++) {
//                let tn = v[j].slice();
//                for (let k = 0; k < 3; k++) {
//                    tn[k] /= this.radius;
//                }
//            }
//          n.push(tn);
//            for (let j = 0; j < 3; j++) 
//                n.push(v3.normalize(v[j]));
            
//            tris.push(new Triangle( v[0], v[1], v[2], 
//                                    n[0], n[1], n[2],            
//                                    [0, 0], [0, 0], [0, 0],
//                                    this.material));
            
        }
        // need to subdivide the icosahedron first, then offset it by the center amount
        return this.subdivide(verts, this.depth);
    }

    subdivide(vt, depth) {
      // array sizes -- 9 floats per face
      let dstArray = twgl.primitives.createAugmentedTypedArray(9, 20*Math.pow(4, depth));
      let srcArray = twgl.primitives.createAugmentedTypedArray(9, 20*Math.pow(4, depth));

      let srcPtr = 0;
      let dstPtr = 0;

      // fill src Array with starting vertices
      for (let i = 0; i < vt.length; i++) {
        let v = vt[i];
        for (let j = 0; j < 3; j++) {
          for (let k = 0; k < 3; k++) {
            srcArray[srcPtr++] = v[j][k];
            dstArray[dstPtr++] = v[j][k];
          }
        }
      }

      for (let i = 0; i < depth; i++) {
        dstPtr = 0;
        let tmp = dstArray;
        dstArray = srcArray;
        srcArray = tmp;
        for (let j = 0; j < srcArray.length; j+=9) {

          let v1 = [srcArray[j], srcArray[j+1], srcArray[j+2]];
          let v2 = [srcArray[j+3], srcArray[j+4], srcArray[j+5]];
          let v3 = [srcArray[j+6], srcArray[j+7], srcArray[j+8]];

          let v12 = [v1[0]+v2[0], v1[1]+v2[1], v1[2]+v2[2]]; //[srcArray[j]+srcArray[j+3], srcArray[j+1] + srcArray[j+4], srcArray[j+2] + srcArray[j+5]];
          let v23 = [v2[0]+v3[0], v2[1]+v3[1], v2[2]+v3[2]]; //[srcArray[j+3]+srcArray[j+6], srcArray[j+4] + srcArray[j+7], srcArray[j+5] + srcArray[j+8]];
          let v31 = [v3[0]+v1[0], v3[1]+v1[1], v3[2]+v1[2]]; //[srcArray[j+6]+srcArray[j], srcArray[j+7] + srcArray[j+1], srcArray[j+8] + srcArray[j+2]];

          let v12L = Math.sqrt(v12[0]*v12[0] + v12[1]*v12[1] + v12[2]*v12[2]);
          let v23L = Math.sqrt(v23[0]*v23[0] + v23[1]*v23[1] + v23[2]*v23[2]);
          let v31L = Math.sqrt(v31[0]*v31[0] + v31[1]*v31[1] + v31[2]*v31[2]);

          for (let k = 0; k < 3; k++) {
            v12[k] /= v12L;
            v23[k] /= v23L;
            v31[k] /= v31L;
          }

          for (let k = 0; k < 3; k++) {
            dstArray[dstPtr++] = v1[k]
          }
          for (let k = 0; k < 3; k++) {
            dstArray[dstPtr++] = v12[k]
          }
          for (let k = 0; k < 3; k++) {
            dstArray[dstPtr++] = v31[k]
          }

          for (let k = 0; k < 3; k++) {
            dstArray[dstPtr++] = v2[k]
          }
          for (let k = 0; k < 3; k++) {
            dstArray[dstPtr++] = v23[k]
          }
          for (let k = 0; k < 3; k++) {
            dstArray[dstPtr++] = v12[k]
          }

          for (let k = 0; k < 3; k++) {
            dstArray[dstPtr++] = v3[k]
          }
          for (let k = 0; k < 3; k++) {
            dstArray[dstPtr++] = v31[k]
          }
          for (let k = 0; k < 3; k++) {
            dstArray[dstPtr++] = v23[k]
          }

          for (let k = 0; k < 3; k++) {
            dstArray[dstPtr++] = v12[k]
          }
          for (let k = 0; k < 3; k++) {
            dstArray[dstPtr++] = v23[k]
          }
          for (let k = 0; k < 3; k++) {
            dstArray[dstPtr++] = v31[k]
          }
        }
      }
      // At this point, dstArray has all the floats for our triangles.
      let tris = new Array(dstArray.length / 9);
      let uv0 = [0, 0];
      for (let i = 0; i < dstArray.length; i+=9) {
          
          let np = [dstArray[i], dstArray[i+1], dstArray[i+2]];
          let nq = [dstArray[i+3], dstArray[i+4], dstArray[i+5]];
          let nr = [dstArray[i+6], dstArray[i+7], dstArray[i+8]];

          let p = [dstArray[i]*this.radius+this.center[0], dstArray[i+1]*this.radius+this.center[1], dstArray[i+2]*this.radius+this.center[2]]; //v3.add(v3.mulScalar(v[0], this.radius), this.center);
          let q = [dstArray[i+3]*this.radius+this.center[0], dstArray[i+4]*this.radius+this.center[1], dstArray[i+5]*this.radius+this.center[2]];
          let r = [dstArray[i+6]*this.radius+this.center[0], dstArray[i+7]*this.radius+this.center[1], dstArray[i+8]*this.radius+this.center[2]];
          tris[i/9] = new Triangle(p, q, r, np, nq, nr, uv0, uv0, uv0, this.material);
      }
      
      return tris;

    }

    subdivide2(vt, depth) {
        let nvt = [];
        if (depth == 0) {
            // turn list of vertices into array of triangles
            let tris = [];
            let uv0 = [0, 0];
            for (let i = 0; i < vt.length; i++) {
                let v = vt[i];
                let p = v3.add(v3.mulScalar(v[0], this.radius), this.center);
                let q = v3.add(v3.mulScalar(v[1], this.radius), this.center);
                let r = v3.add(v3.mulScalar(v[2], this.radius), this.center);
                tris.push(new Triangle(p, q, r, v[0], v[1], v[2], uv0, uv0, uv0, this.material));
            }
            
            return tris;
        }

        for (let i = 0; i < vt.length; i++) {
            let v = vt[i];
            let v12 = v3.add(v[0], v[1]);
            let v23 = v3.add(v[1], v[2]);
            let v31 = v3.add(v[2], v[0]);
            v12 = v3.normalize(v12);
            v23 = v3.normalize(v23);
            v31 = v3.normalize(v31);

            nvt.push([v[0], v12, v31]); // new Triangle(tri.p, v12, v31, tri.p, v12, v31, uv0, uv0, uv0, this.material));
            nvt.push([v[1], v23, v12]); // new Triangle(tri.q, v23, v12, tri.q, v23, v12, uv0, uv0, uv0, this.material));
            nvt.push([v[2], v31, v23]); // new Triangle(tri.r, v31, v23, tri.r, v31, v23, uv0, uv0, uv0, this.material));
            nvt.push([v12, v23, v31]); //new Triangle(v12, v23, v31, v12, v23, v31, uv0, uv0, uv0, this.material));
        }

        return this.subdivide(nvt, depth-1);
    }

    numTriangles() {
        return this.faces.length * Math.pow(4, this.depth);
    }
}

class Scene {
  constructor(primitives, materials) {
    this.primitives = primitives;
    this.materials = materials;
    this.updateBBox();
    this.identifyLights();
    this.scale = Math.max(...this.bbox.max) - Math.min(...this.bbox.min);
  }

  updateBBox() {
      this.bbox = new BBox([99999, 99999, 99999], [-99999, -99999, -99999]);
      for (let i = 0; i < this.primitives.length; i++) {
          this.bbox.expand(this.primitives[i].bbox);
      }

  }

  identifyLights() {
    this.lights = [];
    for (let i = 0; i < this.primitives.length; i++) {
      let prim = this.primitives[i];
      if (prim.material.emission[0] + prim.material.emission[1] + prim.material.emission[2] > 0.0) {
        let primTriangles = prim.toTriangles();
        for (let j = 0; j < primTriangles.length; j++) {
          this.lights.push(new Light(primTriangles[j], prim.material.emission));
        }
      }
    }
  }

  centroid() {
      return this.bbox.centroid;
  }

  toTriangles() {
      let numTris = 0;
      for (let i = 0; i < this.primitives.length; i++) {
          numTris += this.primitives[i].numTriangles();
      }
      let tris = new Array(numTris);
      let triPtr = 0;
      for (let i = 0; i < this.primitives.length; i++) {
        let primTris = this.primitives[i].toTriangles();
        for (let j = 0; j < primTris.length; j++) {
          tris[triPtr++] = primTris[j];
        }
      }
      return tris;
  }

  static cornellBoxGeometry() {
    let floor =     [ 552.8, 0.0, 0.0,
                      0.0, 0.0, 0.0,
                      0.0, 0.0, 559.2,
                      552.8, 0.0, 0.0,
                      0.0, 0.0, 559.2,
                      549.6, 0.0, 559.2 ];

    let light = [     343.0, 548.79, 227.0,
                      343.0, 548.79, 332.0,
                      213.0, 548.79, 332.0,

                      343.0, 548.79, 227.0,
                      213.0, 548.79, 332.0,
                      213.0, 548.79, 227.0 ];

    let ceiling = [   556.0, 548.8, 0.0,
                      556.0, 548.8, 559.2,
                      0.0, 548.8, 559.2,

                      556.0, 548.8, 0.0,
                      0.0, 548.8, 559.2,
                      0.0, 548.8,   0.0 ];


    let backWall = [  0.0, 548.8, 559.2,
                      556.0, 548.8, 559.2,
                      549.6, 0.0, 559.2,

                      0.0, 548.8, 559.2,
                      549.6, 0.0, 559.2,
                      0.0, 0.0, 559.2];

    let rightWall = [ 0.0, 548.8, 0.0,
                      0.0, 548.8, 559.2,
                      0.0, 0.0, 559.2,

                      0.0, 548.8, 0.0,
                      0.0, 0.0, 559.2,
                      0.0, 0.0, 0.0];

      let leftWall = [552.8, 0.0, 0.0,
                      549.6, 0.0, 559.2,
                      556.0, 548.8, 559.2,

                      552.8, 0.0, 0.0,
                      556.0, 548.8, 559.2,
                      556.0, 548.8, 0.0 ];

    // make materials
    var diffuseWhite = new Material({diffuse: [0.7, 0.7, 0.7]});
    var diffuseGreen = new Material({diffuse: [.1, .5, .15]});
    var diffuseRed = new Material({diffuse: [.6, .05, .05]});
    var lightMaterial = new Material({diffuse:[0.78, 0.78, 0.78], emission: [18.4, 15.6, 12.0]});

    let materials = [];
    materials.push(diffuseWhite);
    materials.push(diffuseGreen);
    materials.push(diffuseRed);
    materials.push(lightMaterial);

    // make objects
    let primitives = [];
    primitives.push(new Mesh(floor, null, null, diffuseWhite));
    primitives.push(new Mesh(light, null, null, lightMaterial));
    primitives.push(new Mesh(ceiling, null, null, diffuseWhite));
    primitives.push(new Mesh(backWall, null, null, diffuseWhite));
    primitives.push(new Mesh(rightWall, null, null, diffuseGreen));
    primitives.push(new Mesh(leftWall, null, null, diffuseRed));
//    primitives.push(new Mesh(shortBlock, null, null, diffuseWhite));
//    primitives.push(new Mesh(tallBlock, null, null, diffuseWhite));
//    primitives.push(new Sphere([300, 100, 300], 100, diffuseRed, 3));

    return {primitives, materials};
  }

  static makeCornellBoxWithSphere() {
    let sphereMat = new Material({specular: [.8, .8, .8], transmission: [0, 0, 0], eta: 1.5, type: MIRROR});
  
    let box = Scene.cornellBoxGeometry();
    //let sphereMat = new Material({specular: [.8, .8, .8], transmission: [0, 0, 0], eta: 1.5, type: MIRROR});
    //let sphereMat = new Material({eta: [.155, .424, 1.38], k: [3.60, 2.47, 1.92], alpha: .2, type: CONDUCTOR});
    //let sphereMat = new Material({eta: [2.76, 2.54, 2.27], k: [3.84, 3.43, 3.04], alpha: .01, type: CONDUCTOR});
      
    box.primitives.push(new Sphere([300, 180, 300], 150, sphereMat, 5));
    box.materials.push(sphereMat);
    return new Scene(box.primitives, box.materials);
  }

  static makeCornellBox() {
    let box = Scene.cornellBoxGeometry();
   let shortBlock = [
    130.0, 165.0, 65.0,
    82.0, 165.0, 225.0,
    240.0, 165.0, 272.0,
    130.0, 165.0, 65.0,
    240.0, 165.0, 272.0,
    290.0, 165.0, 114.0,
    290.0, 0.0, 114.0,
    290.0, 165.0, 114.0,
    240.0, 165.0, 272.0,
    290.0, 0.0, 114.0,
    240.0, 165.0, 272.0,
    240.0, 0.0, 272.0,
    130.0, 0.0, 65.0,
    130.0, 165.0, 65.0,
    290.0, 165.0, 114.0,
    130.0, 0.0, 65.0,
    290.0, 165.0, 114.0,
    290.0, 0.0, 114.0,
    82.0, 0.0, 225.0,
    82.0, 165.0, 225.0,
    130.0, 165.0, 65.0,
    82.0, 0.0, 225.0,
    130.0, 165.0, 65.0,
    130.0, 0.0, 65.0,
    240.0, 0.0, 272.0,
    240.0, 165.0, 272.0,
    82.0, 165.0, 225.0,
    240.0, 0.0, 272.0,
    82.0, 165.0, 225.0,
    82.0, 0.0, 225.0];

    let tallBlock = [
    423.0, 330.0, 247.0,
    265.0, 330.0, 296.0,
    314.0, 330.0, 456.0,
    423.0, 330.0, 247.0,
    314.0, 330.0, 456.0,
    472.0, 330.0, 406.0,
    423.0, 0.0, 247.0,
    423.0, 330.0, 247.0,
    472.0, 330.0, 406.0,
    423.0, 0.0, 247.0,
    472.0, 330.0, 406.0,
    472.0, 0.0, 406.0,
    472.0, 0.0, 406.0,
    472.0, 330.0, 406.0,
    314.0, 330.0, 456.0,
    472.0, 0.0, 406.0,
    314.0, 330.0, 456.0,
    314.0, 0.0, 456.0,
    314.0, 0.0, 456.0,
    314.0, 330.0, 456.0,
    265.0, 330.0, 296.0,
    314.0, 0.0, 456.0,
    265.0, 330.0, 296.0,
    265.0, 0.0, 296.0,
    265.0, 0.0, 296.0,
    265.0, 330.0, 296.0,
    423.0, 330.0, 247.0,
    265.0, 0.0, 296.0,
    423.0, 330.0, 247.0,
    423.0, 0.0, 247.0];

    let blockMat = new Material({diffuse: [0.7, 0.7, 0.7]});
    //let blockMat = new Material({specular: [.7, .7, .7], transmission: [.5, .5, .5], eta: 1.2, type: GLASS});
    box.primitives.push(new Mesh(shortBlock, null, null, blockMat));
    box.primitives.push(new Mesh(tallBlock, null, null, blockMat));
    box.materials.push(blockMat);

    return new Scene(box.primitives, box.materials);
  }

  static makeModelInBox(plyText) {
    let meshData = Mesh.readVerticesFromPLY(plyText);
    //let meshMat = new Material({diffuse: [.5, .5, .5], type: PURE_DIFFUSE});
    let meshMat = new Material({specular: [.8, .8, .8], transmission: [0, 0, 0], eta: 1.5, type: MIRROR});
    
    let box = Scene.cornellBoxGeometry();
    let mesh = new Mesh(meshData.outputVertices, meshData.outputNormals, 0, meshMat);
    if (modelName.startsWith("bunny")) {
      mesh.rotate([0, 1, 0], Math.PI);
    }
    else {
      mesh.rotate([1, 0, 0], -Math.PI/2);
    }
    if (modelName.startsWith("airplane")) {
      mesh.rotate([0, 1, 0], Math.PI*.75);
    }
    mesh.scaleTo(400);
    mesh.translateTo([250, 200, 300]);
    box.primitives.push(mesh);
    box.materials.push(meshMat);
    return new Scene(box.primitives, box.materials);
  }

}
