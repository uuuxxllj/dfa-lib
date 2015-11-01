"use strict";


// TODO consider rolling an in-house Set type; this is getting absurd.

function DFA(alphabet, delta, initial, final) {
  /*  alphabet is a list of characters.
      delta an object such that delta[state][sym] = state, for each (state, sym) pair.
        Its own properties are the states of the automaton.
      initial the name of the start state
      final a list of accepting states */
  this.alphabet = alphabet.slice(0)//.sort();
  this.states = Object.getOwnPropertyNames(delta).sort();
  this.delta = delta;
  this.initial = initial;
  this.final = final.slice(0)//.sort();
  this.minimized = false; // internal property: was this produced by minimization?
  
  // todo sanity checking (cf python)
}

DFA.prototype.process = function(str) {
  /* boolean: does my language contain the given string? */
  // todo sanity checking (str in alphabet*)
  var state = this.initial;
  for (var i = 0; i < str.length; ++i) {
    state = this.delta[state][str[i]];
  }
  return this.final.indexOf(state) !== -1;
}

DFA.prototype.minimized = function() {
  /*  non-destructively return the minimal DFA equivalent to this one.
      state names will become meaningless.
      Brzozowski's algorithm = best algorithm */
  var out = this.to_NFA().reversed().to_DFA().to_NFA().reversed().to_DFA();
  out.minimized = true;
  return out;
}

DFA.prototype.without_unreachables = function() { // todo naming conventions
  /*  non-destructively produce equivalent DFA without unreachable states */
  var reached = {};
  reached[this.initial] = true;
  var processing = [this.initial];
  while (processing.length > 0) {
    var cur = processing.shift();
    var map = delta[cur];
    for (var i = 0; i < this.alphabet.length; ++i) {
      var next = map[this.alphabet[i]];
      if (!reached[next]) {
        reached[next] = true;
        processing.push(next);
      }
    }
  }
  var newStates = Object.getOwnPropertyNames(reached);
  var newDelta = {};
  for (i = 0; i < newStates.length; ++i) {
    newDelta[newStates[i]] = delta[newStates[i]];
  }
  var newFinal = final.filter(reached.hasOwnProperty.bind(reached));
  return new DFA(this.alphabet, newStates, newDelta, this.initial, newFinal);
}

DFA.prototype.find_passing = function() {
  /*  Returns one of the shortest strings which will be accepted by the DFA, if such exists.
      Otherwise returns null. */
  // todo dedupe code between this and without_unreachables
  var reached = {};
  reached[this.initial] = '';
  var processing = [this.initial];
  while (processing.length > 0) {
    var cur = processing.shift();
    var map = delta[cur];
    for (var i = 0; i < this.alphabet.length; ++i) {
      var next = map[this.alphabet[i]];
      if (reached[next] === undefined) {
        if (this.final.indexOf(next) !== -1) { // todo for consistency we maybe should use a set, instead of indexOf. although also todo benchmark things instead of just doing best theoretical performance
          return reached[cur] + this.alphabet[i];
        }
        reached[next] = reached[cur] + this.alphabet[i];
        processing.push(next);
      }
    }
  }
  return null;
}


function NFA(alphabet, delta, initial, final) {
  /*  alphabet is a list of characters.
      delta an object such that delta[state][sym] = list of states
        Its own properties are the states of the automaton.
        the epsilon transition is held to be the empty string. so delta[state][''] should also be a list of states.
        it is permissible for delta[state][sym] to be undefined, which will be interpreted the empty set.
      initial a list of start states (in our formalism, multiple start states are allowed; this is obviously equivalent and simplifies some operations, like reversal)
      final a list of accepting states */
  this.alphabet = alphabet.slice(0)//.sort();
  this.states = Object.getOwnPropertyNames(delta).sort();
  this.delta = delta;
  this.initial = initial.slice(0)//.sort(); // maybe should be epsilon closure'd?
  this.final = final.slice(0)//.sort();
  
  // todo sanity checking (cf python)
}

NFA.prototype.epsilon_closure = function(states) {
  /*  Mainly an internal method.
      Given a set of states, return the set of states reachable via 0 or more epsilon transitions from those states.
      Incidentally also deduplicates. */
  var out = deduped(states);
  var processing = out.slice(0);
  while (processing.length > 0) { // TODO this is yet another BFS
    var cur = processing.pop();
    var next = this.delta[cur][''];
    if (next === undefined) {
      continue;
    }
    for (var i = 0; i < next.length; ++i) {
      if (processing.indexOf(next[i]) === -1 && out.indexOf(next[i]) === -1) { // TODO consider alternatives to indexOf
        process.push(next[i]);
        out.push(next[i]);
      }
    }
  }
  return out;
}

NFA.prototype.step = function(states, sym) {
  /*  Given a set of states and a (nonempty) symbol, give the result of running the machine
      for one step. As a prerequisite, states should be equal to its own epsilon closure.
      Does perform epsilon closure at the end. */
  // todo sanity checking? (sym in alphabet)
  states = states.map(function(s) {
    var out = this.delta[state][sym];
    if (out === undefined) {
      return [];
    }
    return out;
  }).reduce(function(a, b) { return a.concat(b); }); // no flatmap, so map + flatten.
  return this.epsilon_closure(states);
}

NFA.prototype.process = function(str) {
  /* boolean: does my language contain the given string? */
  // todo sanity checking (str in alphabet*)
  var states = this.epsilon_closure(this.initial);
  for (var i = 0; i < str.length; ++i) {
    states = this.step(states, str[i]);
  }
  for (i = 0; i < this.final.length; ++i) {
    if (states.indexOf(this.final[i]) !== -1) {
      return true;
    }
  }
  return false;
}

NFA.prototype.to_DFA = function() {
  /*  Return an equivalent DFA. State names become meaningless. */
  function get_name(states) {
    /*  Helper: set of states -> canonical (string) name */
    return states.map(this.states.indexOf.bind(this.states)).sort().join(' ');
  }
  
  var processing = [this.epsilon_closure(this.initial)];
  var newInitial = get_name(processing[0]);
  var newFinal = [];
  var seen = [newInitial];
  var newDelta = {};
  
  while (processing.length > 0) {
    var cur = processing.pop();
    var curName = get_name(cur);
    newDelta[curName] = {};
    
    for (var i = 0; i < this.final.length; ++i) {
      if (cur.indexOf(this.final[i]) !== -1) { // i.e., cur contains an accepting state
        newFinal.push(curName);
        break;
      }
    }
    
    for (i = 0; i < this.alphabet.length; ++i) {
      var sym = this.alphabet[i];
      var next = [];
      for (var j = 0; j < cur.length; ++j) {
        next = next.concat(this.step(cur[j], sym));
      }
      next = deduped(next);
      var nextName = get_name(next);
      newDelta[curName][sym] = nextName;
      if (seen.indexOf(nextName) === -1) { // todo this and all other indexOfs
        seen.push(nextName);
        processing.push(next);
      }
    }
  }
  
  return new DFA(this.alphabet, newDelta, newInitial, newFinal);
}

NFA.prototype.minimized = function() { // TODO remove this?
  /*  non-destructively return the minimal DFA equivalent to this automata.
      state names will become meaningless. */
  return this.to_DFA().minimized();
}

NFA.prototype.reversed = function() {
  /*  non-destructively return the NFA given by reversing all arrows and swapping initial with final.
      The result will accept the reverse of the language of this machine, i.e., all strings whose reverse is accepted by this machine. */
  var newDelta = {};
  for (var i = 0; i < this.states.length; ++i) {
    newDelta[this.states[i]] = {};
  }
  
  for (i = 0; i < this.states.length; ++i) {
    var state = this.states[i];
    for (var j = 0; j <= this.alphabet.length; ++j) {
      var sym = (j == this.alphabet.length) ? '' : this.alphabet[j];
      var res = this.delta[state][sym];
      for (var k = 0; k < res.length; ++k) { // todo three nested loops is almost certainly not the best way to do this.
        var existing = newDelta[res[k]][sym];
        newDelta[res[k]][sym] = (existing === undefined) ? [state] : deduped(existing.concat([state])); // todo could just update in-place
      }
    }
  }
  return new NFA(this.alphabet, newDelta, this.final, this.initial);
}


// library stuff

function deduped(l) { // non-destructively remove duplicates from list. also sorts.
  return l.filter(function(val, index, arr) { return arr.indexOf(val) == index; }).sort();
}

