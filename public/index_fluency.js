const noSave = false;
var fileName;

/* TEMPORARY USE OF ORIGINAL CODE TO TEST THINGS OUT */
try {
    let app = firebase.app();
} catch (e) {
    console.error(e);
}

// Setting up firebase variables
const firestore = firebase.firestore();       // (a.k.a.) db
const firebasestorage = firebase.storage();
const subjectcollection = firestore.collection("Subjects");
const trialcollection = firestore.collection("Trials");

// Function to switch between HTML pages
function show(shown, hidden) {
    document.getElementById(shown).style.display = 'block';
    document.getElementById(hidden).style.display = 'none';
    
    // Scroll to the top
    window.scrollTo({ top: 0, behavior: 'smooth' });

    return false;
}

// Close window (function no longer in use for this version)
function onexit() {
    window.close();
}

// Function used to enter full screen mode
function openFullScreen() {
    elem = document.getElementById('container-info');
    if (elem.requestFullscreen) {
        elem.requestFullscreen();
    } else if (elem.msRequestFullscreen) {
        elem.msRequestFullscreen();
    } else if (elem.mozRequestFullScreen) {
        elem.mozRequestFullScreen();
    } else if (elem.webkitRequestFullscreen) {
        elem.webkitRequestFullscreen();
    }
}

// Function used to exit full screen mode
function closeFullScreen() {
    if (document.exitFullscreen) {
        document.exitFullscreen();
    } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
    } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
    }
}

// Object used to track subject data (uploaded to database)
var subject = {
    id: null,
	condition: null,
    age: null,
    sex: null,
    handedness: null,
    currTrial: 0,
    tgt_file: null,
    ethnicity: null,
    race: null,
    comments: null,
}

// Object used to track reaching data (updated every reach and uploaded to database)
var subjTrials = {
    id: null, // The current trial number with the id
    name: null, // The participant's id for the test
    experimentID: null, // Not important; all of them are "memory"
    startTime: [], // When the participant begins for the current category
    switchTime: [], // whenever press the enter key
    scoreTime: [], // whenever score
    trialNum: [], // The current trial number
    categoryname: [], // The name of the current category
    score: [], // The score for the category
    totalscore: [], // The total score
    minusscore:[], // The score that should be minus when participants didn't answer the attention check correctly
                   // If the participant answers it correct >> 0; if not >> 1 / 3 / 5 / 7 / ......
    time:[], // The remaining time
    partshape:[], // The shape that participant chooses (string)
    partshapeNum:[], // The shape that participant chooses (int) 1 = circle; 2 = triangle; 3 = square; 0 = none
    trueshape:[], // The true shape that appears on the screen (string)
    trueshapeNum:[], // The true shape  that appears on the screen (int) 1 = circle; 2 = triangle; 3 = square
    result:[], // Judge >> If participant answers the check correctly, result = 1; or else result = 0;
    money:[], // How much the participant earns [0, 12]
}

function checkattention() {

    var value2 = $("#attentional").serializeArray();
    var code1 = value2[0].value;
    var code2 = value2[1].value;

    if (code1 != 'total') {
        document.getElementById('goal-feedback').style.display = 'block';
    } else {
        document.getElementById('goal-feedback').style.display = 'none';
    }
    
    if (code2 != 'some') {
        document.getElementById('shape-feedback').style.display = 'block';
    } else {
        document.getElementById('shape-feedback').style.display = 'none';
    }

    if (code1 != 'total' || code2 != 'some') {
    alert("Make sure you understand the instructions before proceeding!")
    return;

    } else {
        show('container-info', 'attention-check');
    }
}

// Function used to check if all questions were filled in info form, if so, starts the experiment 
function checkInfo() {

    // check what browser is used
    // Opera 8.0+
    var isOpera = (!!window.opr && !!opr.addons) || !!window.opera || navigator.userAgent.indexOf(' OPR/') >= 0;
    // Firefox 1.0+
    var isFirefox = typeof InstallTrigger !== 'undefined';
    // Safari 3.0+ "[object HTMLElementConstructor]"
    var isSafari = /constructor/i.test(window.HTMLElement) || (function (p) { return p.toString() === "[object SafariRemoteNotification]"; })(!window['safari'] || (typeof safari !== 'undefined' && safari.pushNotification));
    // Internet Explorer 6-11
    var isIE = /*@cc_on!@*/false || !!document.documentMode;
    // Edge 20+
    var isEdge = !isIE && !!window.StyleMedia;
    // Chrome 1 - 79
    var isChrome = !!window.chrome && (!!window.chrome.webstore || !!window.chrome.runtime);
    // Edge (based on chromium) detection
    var isEdgeChromium = isChrome && (navigator.userAgent.indexOf("Edg") != -1);
    // Blink engine detection
    var isBlink = (isChrome || isOpera) && !!window.CSS;
    if (isOpera) {
        subject.browsertype = 'Opera';
    } else if (isFirefox) {
        subject.browsertype = 'firefox';
    } else if (isIE) {
        subject.browsertype = 'IE';
    } else if (isEdge) {
        subject.browsertype = 'Edge';
    } else if (isChrome) {
        subject.browsertype = 'Chrome';
    } else if (isEdgeChromium) {
        subject.browsertype = 'EdgeChromium';
    } else if (isBlink) {
        subject.browsertype = 'Blink';
    } else if (isSafari) {
        subject.browsertype = 'Safari';
    } else {
        subject.browsertype = 'NotDetected';
    }

    var values = $("#infoform").serializeArray();
    subject.id = values[1].value;
	subject.condition = values[0].value
    subject.age = values[2].value;
    subject.sex = values[3].value;
    subject.handedness = values[4].value;
    subject.returner = values[5].value;
    subject.ethnicity = values[6].value;
    subject.race = values[7].value;
	
	
	if(!subject.condition){
		alert("Please enter condition");
		return;
	}
	
    if (noSave) {
        // show('mouse-control', 'container-info');
        
		show('container-exp', 'container-info');
        openFullScreen();
        startGame();
		return;
    }
    console.log(subject.id);
    console.log(subject.condition);
    console.log(subject.handedness);
    console.log(values)
    if (!subject.id || !subject.age || !subject.sex || !subject.handedness) {
        alert("Please fill out your basic information!");
        return;
    } else {
        // Ask once for a local save folder (Chrome/Edge only; skipped silently on other browsers)
        var _startExperiment = function() {
            createSubject(subjectcollection, subject);
            show('container-exp', 'container-info');
            openFullScreen();
            startGame();
        };
        if (window.DiskWriter && DiskWriter.isSupported()) {
            DiskWriter.pickFolder().then(_startExperiment);
        } else {
            _startExperiment();
        }
    }
}

// Function used to create/update subject data in the database
function createSubject(collection, subject) {
    if (noSave) {
        return null;
    }
    // Save to local disk immediately before attempting Firebase
    if (window.LocalSink) { LocalSink.sendSubject(subject); }
    if (window.DiskWriter) { DiskWriter.writeSubject(subject); }
    return collection.doc(subject.id).set(subject)
        .then(function () {
            return true;
        })
        .catch(function (err) {
            console.error(err);
            throw err;
        });
}

function recordTrialSubj(collection, subjTrials) {
    if (noSave) {
        return null;
    }
    // Save to local disk immediately before attempting Firebase
    if (window.LocalSink) { LocalSink.sendTrial(subjTrials); }
    if (window.DiskWriter) { DiskWriter.writeTrial(subjTrials); }
    return collection.doc(subjTrials.id).set(subjTrials)
        .then(function () {
            return true;
        })
        .catch(function (err) {
            console.error(err);
            throw err;
        });
}



// Variables used throughout the experiment
var svgContainer;
var screen_height;
var screen_width;
var prev_width;
var prev_height;

var experiment_ID;
var subject_ID;

var target_file_data;
var trial;
var num_trials;
var counter = 0;
var fixation_cross;

var startdate;
var laststartdate;
var switchdate;
var scoredate;
var transdate;
var nowdate;

var category;
var categories = [];
var categoryname;
var categorylist = [];
var usedcategory = [];
var categoryStarted = false;
var practiceEnd = false;
var blockEnd = false; // flag set at the end of the first block 

var score;
var totalscore;
var money;
var time;
var timeleft;

// time per block 
var timecount = 15 * 60 * 1000;
var totalPracticeTime = 5 * 60 * 1000;  // 5-minute shared budget across all practice trials
var practiceStartTime = null;            // set once when the first practice trial begins
var isInDelay = false;
var switchTime;
var scoreTime;

var gamephase = -1;
var timer;
var stoptimer;
var blockTimerGeneration = 0; // incremented each time a new block timer is created; each d3 timer captures its own generation and self-stops if it no longer matches
var blockTransitionInProgress = false; // guard against endBlock/endGame being called twice (e.g. d3 timer + pending nextTrial setTimeout)
var pataRunning = false;
var pataReady = false;
var practiceTrial = 1;         // tracks which practice trial we're on (1–4)
var practiceTravelTime = 3;    // seconds between practice trials

var randomNumber;
var shape;
var shaperesult;
var shapepart;
var Fail = true;
var continueFail = false;
var minus = 10;

var moneytime = 0;

// TRAVEL TIME 
// var phase = 5 - moneytime; // 75 / 45 / 20 / 5
var phase;
var travel_time_index = 0;
var question_time = 0; // 7
var empty_time = 0; // 3
var time_shape;
var time_period;

var mediaRecorder;
var audioChunks = [];
var csvContent;
var isRecording = false;
var recognition;

// Object to save reach data per reach, usage has become slightly obsolete but is still used as an intermediate object to store data before uploading to database
var reachData = {
    experiment_ID: '',
    subject_ID: '',
    current_date: '',
    trial: '',
    option: ''
}

// All game functions are defined within this main function, treat as "main"
function gameSetup(data) {

    /*********************
    * Browser Settings  *
    *********************/
    // Initializations to make the screen full size and black background
    $('html').css('height', '98%');
    $('html').css('width', '100%');
    $('html').css('background-color', 'white');
    $('body').css('background-color', 'white');
    $('body').css('height', '98%');
    $('body').css('width', '100%');

    // Hide the mouse from view 
    $('html').css('cursor', 'none');
    $('body').css('cursor', 'none');

    // SVG container from D3.js to hold drawn items
    svgContainer = d3.select("body").append("svg")
        .attr("width", "100%")
        .attr("height", "100%")
        .attr('fill', 'black')
        .attr('id', 'stage');

    // Getting the screen resolution
    screen_height = window.screen.availHeight;
    screen_width = window.screen.availWidth;

    // Experiment parameters, subject_ID is no obsolete
    experiment_ID = subject.condition; // this indicates which travel order was used
    subject_ID = Math.floor(Math.random() * 10000000000);

    // Reading the json target file into the game
    target_file_data = data;
	
	// num trials per block
    num_trials = target_file_data.numtrials/2; // half the total number of trials per each block 
    categorylist = Object.values(target_file_data.items)
	indexorderA = Object.values(target_file_data.orderA)
	travel = Object.values(target_file_data.travel)
	index = indexorderA[counter] - 1
    categoryname = categorylist[index]
	

    console.log(num_trials)
	console.log("Index = "+ index + "Category: " + categoryname)

    /***************************
    * Drawn Element Properties *
    ***************************/

    // Setting parameters
    score = 0;
    totalscore = 0;
    money = 0;
	
    totalTrials = data.numtrials;
    fixation_cross = "fixation.png"
    shape = "shape.png"

    // Show the categories
    svgContainer.append('text')
        .attr('text-anchor', 'middle')
        .attr('x', screen_width / 2)
        .attr('y', screen_height / 3 + 30)
        .attr('font-size', '60')
        .attr('font-weight', 'bold')
        .attr('fill', 'black')
        .attr('id', 'category')
        .attr('display', 'none')
        .attr('font-family', 'Arial')
        .text(categoryname);

    // Trees for practice
    svgContainer.append('text')
        .attr('text-anchor', 'middle')
        .attr('x', screen_width / 2)
        .attr('y', screen_height / 3 + 30)
        .attr('font-size', '80')
        .attr('fill', 'black')
        .attr('id', 'practice1')
        .attr('display', 'none')
        .attr('font-weight', 'bold')
        .attr('font-family', 'Arial')
        .text("TREES");
    
    // Pie for practice
    svgContainer.append('text')
        .attr('text-anchor', 'middle')
        .attr('x', screen_width / 2)
        .attr('y', screen_height / 3 + 30)
        .attr('font-size', '80')
        .attr('fill', 'black')
        .attr('id', 'practice2')
        .attr('display', 'none')
        .attr('font-weight', 'bold')
        .attr('font-family', 'Arial')
        .text("COUNTRIES");

    // Types of Pie for practice
    svgContainer.append('text')
        .attr('text-anchor', 'middle')
        .attr('x', screen_width / 2)
        .attr('y', screen_height / 3 + 30)
        .attr('font-size', '80')
        .attr('fill', 'black')
        .attr('id', 'practice3')
        .attr('display', 'none')
        .attr('font-weight', 'bold')
        .attr('font-family', 'Arial')
        .text("TYPES OF PIE");

    // Cities for practice
    svgContainer.append('text')
        .attr('text-anchor', 'middle')
        .attr('x', screen_width / 2)
        .attr('y', screen_height / 3 + 30)
        .attr('font-size', '80')
        .attr('fill', 'black')
        .attr('id', 'practice4')
        .attr('display', 'none')
        .attr('font-weight', 'bold')
        .attr('font-family', 'Arial')
        .text("CITIES");

    // Show the scores
    svgContainer.append('text')
        .attr('text-anchor', 'middle')
        .attr('x', screen_width / 2)
        .attr('y', screen_height / 2)
        .attr('font-size', '40')
        .attr('fill', 'black')
        .attr('id', 'score')
        .attr('font-family', 'Arial')
        .attr('display', 'none')
        .text('Score: ' + score);
    
    // Show the enter notes
        svgContainer.append('text')
        .attr('text-anchor', 'middle')
        .attr('x', screen_width / 2)
        .attr('y', 7 * screen_height / 8)
        .attr('font-size', '24')
        .attr('fill', 'black')
        .attr('id', 'enter')
        .attr('font-family', 'Arial')
        .attr('display', 'none')
        .text('Press "Enter" when you are ready to move to the next category');

    // Show the total scores
    svgContainer.append('text')
        .attr('text-anchor', 'middle')
        .attr('x', screen_width - screen_width / 7)
        .attr('y', screen_height / 15 + 70)
        .attr('font-size', '50')
        .attr('fill', 'red')
        .attr('font-weight', 'bold')
        .attr('id', 'total')
        .attr('font-family', 'Arial')
        .attr('display', 'none')
        .text('Total Score: ' + totalscore);

    // Show the time
    svgContainer.append('text')
        .attr('text-anchor', 'middle')
        .attr('x', screen_width - screen_width / 7)
        .attr('y', screen_height / 15)
        .attr('font-size', '50')
        .attr('fill', 'red')
        .attr('font-weight', 'bold')
        .attr('id', 'time')
        .attr('font-family', 'Arial')
        .attr('display', 'none')
        .text('Time left:  ' + time);

    // Show the money participants earned
    svgContainer.append('text')
        .attr('text-anchor', 'middle')
        .attr('x', screen_width / 2)
        .attr('y', screen_height / 2)
        .attr('font-size', '60')
        .attr('fill', 'black')
        .attr('id', 'money')
        .attr('font-family', 'Arial')
        .attr('display', 'none')
        .text('You have earned $' + money + ' !'); 
    
    // Show the instructions for the practice
    svgContainer.append('text')
        .attr('text-anchor', 'middle')
        .attr('x', screen_width / 2)
        .attr('y', screen_height / 2 - 100)
        .attr('font-size', '32')
        .attr('fill', 'black')
        .attr('id', 'instruc1')
        .attr('font-family', 'Arial')
        .text('This is a practice trial to help you better understand the task.');

    // Show the instructions for the practice
    svgContainer.append('text')
        .attr('text-anchor', 'middle')
        .attr('x', screen_width / 2)
        .attr('y', screen_height / 2 - 50)
        .attr('font-size', '32')
        .attr('fill', 'black')
        .attr('id', 'instruc1_2')
        .attr('font-family', 'Arial')
        .text('Scores and time will not be counted towards the main task.');

    // PATA rate test title screen
    svgContainer.append('text')
        .attr('text-anchor', 'middle')
        .attr('x', screen_width / 2)
        .attr('y', screen_height / 2)
        .attr('font-size', '72')
        .attr('font-weight', 'bold')
        .attr('fill', 'black')
        .attr('id', 'pata_screen_title')
        .attr('font-family', 'Arial')
        .attr('display', 'none')
        .text('PATA Rate Test');

    // Show the PATA instructions
    svgContainer.append('text')
        .attr('text-anchor', 'middle')
        .attr('x', screen_width / 2)
        .attr('y', screen_height / 2 - 100)
        .attr('font-size', '32')
        .attr('fill', 'black')
        .attr('id', 'pata_instructions')
        .attr('font-family', 'Arial')
        .attr('display', 'none')
        .text('When the GO cue appears, repeat "PATA" as quickly as possible for 10 seconds.');

    // GO cue for PATA test
    svgContainer.append('text')
        .attr('text-anchor', 'middle')
        .attr('x', screen_width / 2)
        .attr('y', screen_height / 2)
        .attr('font-size', '120')
        .attr('font-weight', 'bold')
        .attr('fill', 'green')
        .attr('id', 'pata_go')
        .attr('font-family', 'Arial')
        .attr('display', 'none')
        .text('GO');

    // STOP cue for PATA test
    svgContainer.append('text')
        .attr('text-anchor', 'middle')
        .attr('x', screen_width / 2)
        .attr('y', screen_height / 2)
        .attr('font-size', '120')
        .attr('font-weight', 'bold')
        .attr('fill', 'red')
        .attr('id', 'pata_stop')
        .attr('font-family', 'Arial')
        .attr('display', 'none')
        .text('STOP');

    // Show the between-PATA-trials message
    svgContainer.append('text')
        .attr('text-anchor', 'middle')
        .attr('x', screen_width / 2)
        .attr('y', screen_height / 2 + 100)
        .attr('font-size', '32')
        .attr('fill', 'black')
        .attr('id', 'pata_between_trials')
        .attr('font-family', 'Arial')
        .attr('display', 'none')
        .text('Trial 1 complete! Press SPACE to begin trial 2.');

    // Show the instructions for the practice
    svgContainer.append('text')
        .attr('text-anchor', 'middle')
        .attr('x', screen_width / 2)
        .attr('y', screen_height / 2 - 150)
        .attr('font-size', '60')
        .attr('fill', 'black')
        .attr('id', 'instruc1_end_block')
        .attr('font-family', 'Arial')
		.attr('display', 'none')
        .text('End of the first block!');

    // Show the instructions for practice trials
    svgContainer.append('text')
        .attr('text-anchor', 'middle')
        .attr('x', screen_width / 2)
        .attr('y', screen_height / 2 - 50)
        .attr('font-size', '40')
        .attr('fill', 'black')
        .attr('id', 'instruc_practice')
        .attr('font-family', 'Arial')
        .attr('display', 'none')
        .text('PRACTICE TRIALS');

    // Show the instructions for the main task
    svgContainer.append('text')
        .attr('text-anchor', 'middle')
        .attr('x', screen_width / 2)
        .attr('y', screen_height / 2 - 50)
        .attr('font-size', '40')
        .attr('fill', 'black')
        .attr('id', 'instruc3')
        .attr('font-family', 'Arial')
        .attr('display', 'none')
        .text('YOU ARE READY TO BEGIN THE MAIN EXPERIMENT');

    svgContainer.append('text')
        .attr('text-anchor', 'middle')
        .attr('x', screen_width / 2)
        .attr('y', screen_height / 2 + 100)
        .attr('font-size', '32')
        .attr('fill', 'black')
        .attr('id', 'instruc2')
        .attr('font-family', 'Arial')
        .text('Press the SPACE BAR when you are ready.');
    
    // Mark the time delay
    svgContainer.append('text')
        .attr('text-anchor', 'middle')
        .attr('x', screen_width / 2)
        .attr('y', screen_height / 3)
        .attr('font-size', '72')
        .attr('fill', 'red')
        .attr('font-weight', 'bold')
        .attr('id', 'delay')
        .attr('display', 'none')
        .attr('font-family', 'Arial')
        .text('POINT ACCUMULATION ON HOLD!');

    // Mark the time delay
    svgContainer.append('text')
        .attr('text-anchor', 'middle')
        .attr('x', screen_width / 2)
        .attr('y', screen_height / 2 - 20)
        .attr('font-size', '32')
        .attr('fill', 'black')
        .attr('id', 'prepare')
        .attr('display', 'none')
        .attr('font-family', 'Arial')
        .text('Prepare for the next category');

    // Mark the attention check
    svgContainer.append('text')
        .attr('text-anchor', 'middle')
        .attr('x', screen_width / 2)
        .attr('y', screen_height / 2 + 50)
        .attr('font-size', '32')
        .attr('fill', 'black')
        .attr('id', 'attention')
        .attr('display', 'none')
        .attr('font-family', 'Arial')
        .text('Please continue to pay attention to the task!');

    // Draw the fixation cross
    svgContainer.append('image')
        .attr('x', screen_width / 2 - screen_height / 20)
        .attr('y', 2 * screen_height / 3 - screen_height / 20 + 10)
        .attr('width', screen_height / 10)
        .attr('height', screen_height / 10)
        .attr('href', fixation_cross)
        .attr('id', 'fixation')
        .attr('display', 'none');

    // Create a blue circle
    svgContainer.append('circle')
        .attr("cx", screen_width / 2)
        .attr("cy", 2 * screen_height / 3 + 10)
        .attr("r", screen_height / 20)
        .attr("fill", "blue")
        .attr('id', 'circle')
        .attr('display', 'none');

    // Create a blue square
    svgContainer.append('rect')
        .attr('x', screen_width / 2 - screen_height / 20)
        .attr('y', 2 * screen_height / 3 - screen_height / 20 + 10)
        .attr('width', screen_height / 10)
        .attr('height', screen_height / 10)
        .attr('fill', 'blue')
        .attr('id', 'square') 
        .attr('display', 'none');

    // Create a blue triangle
    svgContainer.append("polygon")
        .attr("points", function() {
            var x = screen_width / 2;
            var y = 2 * screen_height / 3 + 10;
            var size = screen_height / 10;
            return [
                [x, y - size / Math.sqrt(3)].join(","),
                [x - size / 2, y + size / (2 * Math.sqrt(3))].join(","),
                [x + size / 2, y + size / (2 * Math.sqrt(3))].join(",")
            ].join(" ");
        })
        .attr("fill", "blue")
        .attr('id', 'triangle')
        .attr('display', 'none');

    // Mark the attentional check
    svgContainer.append('text')
        .attr('text-anchor', 'middle')
        .attr('x', screen_width / 2)
        .attr('y', 2 * screen_height / 3 - 50)
        .attr('font-size', '40')
        .attr('fill', 'black')
        .attr('id', 'check1')
        .attr('display', 'none')
        .attr('font-family', 'Arial')
        .text('What shape did you just see?');
/*    
    // Mark the attentional check
        svgContainer.append('image')
        .attr('text-anchor', 'middle')
        .attr('x', screen_width / 2 - 8.525 * screen_height / 20)
        .attr('y', 2 * screen_height / 3 - screen_height / 20 + 50)
        .attr('width', 8.525 * screen_height / 10)
        .attr('height', screen_height / 10)
        .attr('href', shape)
        .attr('id', 'check2')
        .attr('display', 'none');

    // Press "z" if it was a triangle; Press "v" if it was a circle; Press "m" if it was a square
    svgContainer.append('text')
        .attr('text-anchor', 'middle')
        .attr('x', screen_width / 2)
        .attr('y', 7 * screen_height / 8)
        .attr('font-size', '24')
        .attr('fill', 'black')
        .attr('id', 'press')
        .attr('font-family', 'Arial')
        .attr('display', 'none')
        .text('Press "Z" if it was a triangle; Press "V" if it was a circle; Press "M" if it was a square');
*/
    // Show the total scores in attentional check
    svgContainer.append('text')
        .attr('text-anchor', 'middle')
        .attr('x', screen_width / 2)
        .attr('y', screen_height / 2 - 20)
        .attr('font-size', '40')
        .attr('fill', 'black')
        .attr('id', 'total2')
        .attr('font-family', 'Arial')
        .attr('display', 'none')
        .text('Total Score: ' + totalscore); 

    // Show the response of the attentional check
    // Correct!
    svgContainer.append('text')
        .attr('text-anchor', 'middle')
        .attr('x', screen_width / 2 + 100)
        .attr('y', screen_height / 2 + 20)
        .attr('font-size', '32')
        .attr('fill', 'green')
        .attr('id', 'correct')
        .attr('font-family', 'Arial')
        .attr('display', 'none')
        .text('Correct!'); 

    // Wrong!
    svgContainer.append('text')
        .attr('text-anchor', 'middle')
        .attr('x', screen_width / 2 + 100)
        .attr('y', screen_height / 2 + 20)
        .attr('font-size', '32')
        .attr('fill', 'red')
        .attr('id', 'wrong')
        .attr('font-family', 'Arial')
        .attr('display', 'none')
        .text('Wrong!'); 

    // Score
    svgContainer.append('text')
        .attr('text-anchor', 'middle')
        .attr('x', screen_width / 2 + 180)
        .attr('y', screen_height / 2 - 20)
        .attr('font-size', '32')
        .attr('fill', 'red')
        .attr('id', 'minus')
        .attr('font-family', 'Arial')
        .attr('display', 'none')
        .text('- ' + minus); 

    /***************************************
    * Pointer Lock Variables and Functions *
    ***************************************/
    document.requestPointerLock = document.requestPointerLock || document.mozRequestPointerLock;
    document.exitPointerLock = document.exitPointerLock || document.mozExitPointerLock;
    window.addEventListener('resize', monitorWindow, false);
    document.addEventListener('keydown', handleKeyPress);

    // Function to set pointer lock and log it
    function setPointerLock() {
        console.log("Attempted to lock pointer");
        stage.requestPointerLock();
    }
    setPointerLock();

    // Function to monitor changes in screen size;
    function monitorWindow(event) {
        var prev_size = prev_width * prev_height;
        var curr_size = window.innerHeight * window.innerWidth;
        console.log("prev size: " + prev_size + " curr size: " + curr_size);
        if (prev_size > curr_size) {
            alert("Please enter full screen and click your mouse to continue the experiment!");
        }
        prev_width = window.innerWidth;
        prev_height = window.innerHeight;
        return;
    }

    trial = 1;
    startTrial();
}

//Game phases
// -1 : PATA rate test title screen
// 0  : PATA rate test trial 1
// 0.5: PATA rate test trial 2
// 0.75: practice instructions
// 1  : practice
// 2  : 2nd practice trial
// 3  : main block
// 4  : travel
// 5  : between blocks
// 6  : second block


// Function used to start reach trials 
function startTrial() {
	
	console.log("ENTERING startTrial; gamephase = " + gamephase)
    document.addEventListener('keydown', handleKeyPress);

    svgContainer.select("#delay").attr("display", "none");
    svgContainer.select("#prepare").attr("display", "none");
    svgContainer.select("#attention").attr("display", "none");
    svgContainer.select("#circle").attr("display", "none");
    svgContainer.select("#triangle").attr("display", "none");
    svgContainer.select("#square").attr("display", "none");

    
    // Start the timer
    if (gamephase === -1) {
        svgContainer.select("#instruc1").attr("display", "none");
        svgContainer.select("#instruc1_2").attr("display", "none");
        svgContainer.select("#pata_screen_title").attr("display", "block");
        svgContainer.select("#instruc2").attr("display", "block");
    }

    if (gamephase === 0) {
        startPATATest(1);
    }

    if (gamephase === 0.5) {
        startPATATest(2);
    }

    if (gamephase === 0.75) {
        svgContainer.select("#instruc1").attr("display", "block");
        svgContainer.select("#instruc1_2").attr("display", "block");
        svgContainer.select("#instruc2").attr("display", "block");
    }

    if (gamephase === 2) {
        svgContainer.select("#instruc3").attr("display", "block");
        svgContainer.select("#instruc2").attr("display", "block");
        svgContainer.select("#instruc_practice").attr("display", "none");
        practiceEnd = true;
        stoptimer = true;
    }
	

    if (gamephase === 3) {

		startCategory();
		
    }
	
	if (gamephase === 5) {
        svgContainer.select("#instruc1_end_block").attr("display", "block");
        svgContainer.select("#instruc2").attr("display", "block");
		stoptimer = true;
		blockEnd = true;
		

	}
	
	if (gamephase === 6) {
        // svgContainer.select("#instruc1_end_block").attr("display", "none");
        // svgContainer.select("#instruc2").attr("display", "none");
		startCategory();
	}
    
}

function startCategory() {
    nowdate = new Date();

    svgContainer.select("#instruc3").attr("display", "none");
    svgContainer.select("#instruc2").attr("display", "none");
	svgContainer.select("#money").attr("display", "none");

    if (trial === 1) {
        startdate = Date.now();
        startTime = 0;
    }
    else {
        startTime = nowdate - startdate;
    }

    console.log('start time: ' + startTime);
    
    subjTrials.startTime = startTime;
	phase = travel[travel_time_index] - moneytime
/*
    // Random assign the categories' name
    do {
        counter = Math.floor(Math.random() * 25);
    } while (usedcategory.includes(counter));

    usedcategory.push(counter);
    

    console.log('Random counter value:', counter);
*/
	index = indexorderA[counter] - 1 //0 start
    categoryname = categorylist[index]
	console.log("Index = "+ index + "Category: " + categoryname)
    // categoryname = categorylist[counter]
    document.addEventListener('keydown', handleKeyPress);

    svgContainer.select("#category")
        .attr("display", "block")
        .text(categoryname);

    svgContainer.select("#score").attr("display", "block");
    svgContainer.select("#enter").attr("display", "block");
    svgContainer.select("#time").attr("display", "block");
    svgContainer.select("#total")
        .text('Total Score: ' + totalscore)
        .attr("display", "block");

    svgContainer.select("#check1").attr("display", "none");
    svgContainer.select("#check2").attr("display", "none");
    svgContainer.select("#total2").attr("display", "none");
    svgContainer.select("#correct").attr("display", "none");
    svgContainer.select("#wrong").attr("display", "none");
    svgContainer.select("#minus").attr("display", "none");
    svgContainer.select("#press").attr("display", "none");
    svgContainer.select("#fixation").attr("display", "none");

    score = 0;

    // Start recording when category starts
    startRecording();
}


function practicetrial() {
    // Hide all practice elements then show the current one
    svgContainer.select("#practice1").attr("display", "none");
    svgContainer.select("#practice2").attr("display", "none");
    svgContainer.select("#practice3").attr("display", "none");
    svgContainer.select("#practice4").attr("display", "none");
    svgContainer.select("#practice" + practiceTrial).attr("display", "block");
    svgContainer.select("#instruc1").attr("display", "none");
    svgContainer.select("#instruc1_2").attr("display", "none");
    svgContainer.select("#instruc2").attr("display", "none");
    svgContainer.select("#instruc_practice").attr("display", "none");
    svgContainer.select("#score").attr("display", "block");
    svgContainer.select("#enter").attr("display", "block");
    svgContainer.select("#time").attr("display", "block");
    svgContainer.select("#total").attr("display", "block");
    stoptimer = false;
    // Start the shared 5-minute clock on the very first practice trial
    if (practiceStartTime === null) {
        practiceStartTime = Date.now();
    }
    startRecording();

    d3.timer(function(){
        if (stoptimer) {
            return true;
        }

        // Use a single shared clock so all practice trials share the 5-minute budget
        timeleft = Math.max(0, totalPracticeTime - (Date.now() - practiceStartTime));
        let minutes = Math.floor(timeleft / (1000 * 60)); 
        let seconds = Math.floor((timeleft % (1000 * 60)) / 1000);

        time = d3.format("02")(minutes) + ":" + d3.format("02")(seconds);

        svgContainer.select("#score")
            .text("Score: " + score);

        svgContainer.select("#time")
            .text("Time Left:  " + time);

        svgContainer.select("#total")
            .text('Total Score: ' + totalscore);

        // End practice entirely when the 5-minute budget is exhausted
        if (timeleft <= 0) {
            stoptimer = true;
            svgContainer.select("#practice" + practiceTrial).attr("display", "none");
            practiceTrial = 5; // force nextpractice() to exit practice phase
            svgContainer.select("#enter").attr("display", "none");
            svgContainer.select("#time").attr("display", "none");
            svgContainer.select("#total").attr("display", "none");
            svgContainer.select("#score").attr("display", "none");
            stopRecording();
            showMoney();
            return true;
        }
    });
}

function startPATATest(trialNum) {
    // Hide any leftover elements
    svgContainer.select("#instruc1").attr("display", "none");
    svgContainer.select("#instruc1_2").attr("display", "none");
    svgContainer.select("#pata_between_trials").attr("display", "none");
    svgContainer.select("#pata_go").attr("display", "none");
    svgContainer.select("#pata_stop").attr("display", "none");
    svgContainer.select("#instruc_practice").attr("display", "none");

    // Show instructions and prompt to press SPACE
    svgContainer.select("#pata_instructions").attr("display", "block");
    svgContainer.select("#instruc2").attr("display", "block");
    pataReady = true;
}

function runPATATimer(trialNum) {
    pataReady = false;
    pataRunning = true;

    // Tag the recording so it gets a meaningful filename
    categoryname = 'pata-trial-' + trialNum;

    // Hide instructions, show GO
    svgContainer.select("#pata_instructions").attr("display", "none");
    svgContainer.select("#instruc2").attr("display", "none");
    svgContainer.select("#pata_go").attr("display", "block");

    // Start recording
    startRecording();

    // 10-second PATA window
    const pataTestDuration = 10 * 1000;

    d3.timer(function(elapsed) {
        if (elapsed >= pataTestDuration) {
            stopRecording();
            pataRunning = false;

            // Replace GO with STOP
            svgContainer.select("#pata_go").attr("display", "none");
            svgContainer.select("#pata_stop").attr("display", "block");

            // After 1s remove STOP and show next screen
            setTimeout(function() {
                svgContainer.select("#pata_stop").attr("display", "none");

                if (trialNum === 1) {
                    gamephase = 0.5;
                    svgContainer.select("#pata_between_trials").attr("display", "block");
                } else {
                    gamephase = 0.75;
                    svgContainer.select("#pata_instructions").attr("display", "none");
                    svgContainer.select("#pata_screen_title").attr("display", "none");
                    svgContainer.select("#instruc1").attr("display", "block");
                    svgContainer.select("#instruc1_2").attr("display", "block");
                    svgContainer.select("#instruc2").attr("display", "block");
                }
            }, 1000);

            return true; // Stop d3 timer
        }
    });
}

function handleKeyPress(event) {
    if (event.key === 'Enter') {
        if (gamephase === 1) {
            svgContainer.select("#practice1").attr("display", "none");
            svgContainer.select("#practice2").attr("display", "none");
            svgContainer.select("#practice3").attr("display", "none");
            svgContainer.select("#practice4").attr("display", "none");
            stoptimer = true;
            if (!isInDelay) {
                showMoney();
                stopRecording();
            }
        }

        else if (gamephase === 3 || gamephase === 6) {
            stoptimer = true;

            // get the switch time
            switchdate = new Date();
            switchTime = switchdate - startdate;
            subjTrials.switchTime = switchTime;

            console.log('switch time: ' + switchTime);

            if (!isInDelay) {
                stopRecording();
                showMoney();
            }
        }
    }

    else if ((event.key === 'Space' || event.key === " ")) {
        if (gamephase === -1) {
            svgContainer.select("#pata_screen_title").attr("display", "none");
            svgContainer.select("#instruc2").attr("display", "none");
            gamephase = 0;
            startTrial();
        }

        else if (gamephase === 0 && !pataRunning) {
            if (pataReady) {
                runPATATimer(1);
            }
        }

        else if (gamephase === 0.5 && !pataRunning) {
            if (pataReady) {
                runPATATimer(2);
            } else {
                // Between-trials screen: hide it and show trial 2 instructions
                svgContainer.select("#pata_between_trials").attr("display", "none");
                startPATATest(2);
            }
        }

        else if (gamephase === 0.75) {
            // Practice instructions screen — hide and start practice
            svgContainer.select("#instruc1").attr("display", "none");
            svgContainer.select("#instruc1_2").attr("display", "none");
            svgContainer.select("#instruc2").attr("display", "none");
            gamephase = 1;
            stoptimer = false;
            practicetrial();
        }

        // else if (gamephase === 2 && practiceEnd) {
        //     gamephase = 3;
        // }
        //
        // else if (gamephase === 5 && blockEnd) {
        //     gamephase = 6;
        // }

		
        else if ( ((gamephase === 2 && practiceEnd) || (gamephase === 5 && blockEnd)) && !categoryStarted) {
			//             svgContainer.select("#instruc3").attr("display", "none");
			//             svgContainer.select("#instruc2").attr("display", "none");
			svgContainer.select("#instruc1_end_block").attr("display", "none");
			
			if ( gamephase===2 ){
				gamephase = 3;
			} else if (gamephase === 5){
				gamephase = 6;
			}
            
            score = 0;
            totalscore = 0;
            categoryStarted = true;
            blockTimerGeneration++; // invalidate any previously running block d3 timer
            var myGeneration = blockTimerGeneration;
            blockTransitionInProgress = false;
    
            d3.timer(function(elapsed){
                if (myGeneration !== blockTimerGeneration) { return true; } // stale timer from a previous block
                timeleft = Math.max(0, timecount - elapsed);
                let minutes = Math.floor(timeleft / (1000 * 60)); 
                let seconds = Math.floor((timeleft % (1000 * 60)) / 1000);
        
                time = d3.format("02")(minutes) + ":" + d3.format("02")(seconds);
        
                svgContainer.select("#score").text("Score: " + score);
                svgContainer.select("#time").text("Time Left:  " + time);
                svgContainer.select("#total").text('Total Score: ' + totalscore);
    
        
                // End the timer if time is up
                if (timeleft <= 0) {
                    stopRecording(); 
    
                    subjTrials.experimentID = experiment_ID;
                    subjTrials.id = subject.id.concat(trial.toString());
                    subjTrials.name = subject.id;
                    screen_height = window.screen.availHeight;
                    screen_width = window.screen.availWidth;
                
                    subjTrials.score = score;
                    subjTrials.time = time;
                    subjTrials.trialNum = trial;
                    subjTrials.categoryname = categoryname;
                    subjTrials.totalscore = totalscore;
                    subject.currTrial = trial;
                    subjTrials.money = money;
    
                    recordTrialSubj(trialcollection, subjTrials);
                    createSubject(subjectcollection, subject);
										//
					if (!blockEnd) {
						 blockEnd = true;
						 console.log("END OF FIRST BLOCK!!!!")
					     endBlock();
					} else {
					    endGame();
					}
					// endGame();
                    return true; // Stop recording when time is up
                }
            });
    
            startCategory();
        }
		
		// add a condtion for gamephase 5  
       
    }

    else if (event.key === '1' && !isInDelay && (gamephase === 3 || gamephase === 6 || gamephase === 1)) {
        score++;
        totalscore++;

        money = totalscore * 0.05;
        money = (totalscore * 0.05).toFixed(2);

        if (gamephase === 3) {
            scoredate = new Date();
            scoreTime = scoredate - startdate;
            subjTrials.scoreTime.push(scoreTime);

            console.log('score time: ' + scoreTime);

            if (money < 0) {
                money = 0;
            }

        }
    }

    else if (gamephase === 4) {
        // z = triangle; v = circle; m = square
        // 1 = circle; 2 = triangle; 3 = square

        if (event.key === 'z') {
            shapepart = 'triangle';
            subjTrials.partshape = shapepart;
            subjTrials.partshapeNum = 2;

            if (randomNumber === 2) {
                Fail = false;
                continueFail = false;
    
                shaperesult = 1;
                subjTrials.result = shaperesult;
    
                gamephase = 3;
            }
        }

        else if (event.key === 'v') {
            shapepart = 'circle';
            subjTrials.partshape = shapepart;
            subjTrials.partshapeNum = 1;

            if (randomNumber === 1) {
                Fail = false;
                continueFail = false;
    
                shaperesult = 1;
                subjTrials.result = shaperesult;
    
                gamephase = 3;
            }
        }

        else if (event.key === 'm') {
            shapepart = 'square';
            subjTrials.partshape = shapepart;
            subjTrials.partshapeNum = 3;

            if (randomNumber === 3) {
                Fail = false;
                continueFail = false;
    
                shaperesult = 1;
                subjTrials.result = shaperesult;
    
                gamephase = 3;
            }
        }

        else {

            Fail = true;

            shaperesult = 0;
            subjTrials.result = shaperesult;

            shapepart = 'none';
            subjTrials.partshape = shapepart;
            subjTrials.partshapeNum = 0;

            gamephase = 3;
        }
        
        console.log(shapepart)

        /*
        if ((event.key === 'z' && shape === 3) || (event.key === 'v' && shape === 0) || (event.key === 'm' && shape === 6)) {
            Fail = false;
            continueFail = false;

            shaperesult = 1;
            subjTrials.result = shaperesult;

            gamephase = 2;

        } else {
            Fail = true;

            shaperesult = 0;
            subjTrials.result = shaperesult;

            gamephase = 2;
        }
        */
    }
}

// Separate page for money that participant earned
function showMoney() {
    isInDelay = true;
    document.removeEventListener('keydown', handleKeyPress);

    svgContainer.select("#category").attr("display", "none");
    svgContainer.select("#score").attr("display", "none");
    svgContainer.select("#time").attr("display", "none");
    svgContainer.select("#total").attr("display", "none");
    svgContainer.select("#enter").attr("display", "none");
    svgContainer.select("#practice1").attr("display", "none");
    svgContainer.select("#practice2").attr("display", "none");

    subjTrials.money = money;

    svgContainer.select("#money")
        .attr("display", "none")
        .text('You have earned $' + money + ' !');

    setTimeout(startDelay, 0);
    
}

// Time Delay for the beginning
function startDelay() {
    svgContainer.select("#money").attr("display", "none");
    svgContainer.select("#delay").attr("display", "block");
    svgContainer.select("#prepare").attr("display", "block");
    svgContainer.select("#attention").attr("display", "block");
    // svgContainer.select("#fixation").attr("display", "block");
    
    // Calculate the delay period
    time_period = phase

    if (gamephase === 1) {
        setTimeout(nextpractice, 1000 * practiceTravelTime);
    }

    else {
        setTimeout(nextTrial, 1000 * phase);
    }

}

// Appear the shape for 500ms
function shapeAppear() {
    svgContainer.select("#fixation").attr("display", "none");

    // If the random number is 1, the circle appears
    if (randomNumber === 1) {
        svgContainer.select("#circle").attr("display", "block");
    }

    // If the random number is 2, the triangle appears
    if (randomNumber === 2) {
        svgContainer.select("#triangle").attr("display", "block");
    }

    if (randomNumber === 3) {
        svgContainer.select("#square").attr("display", "block");
    }

    setTimeout(continueDelay, 500);

}

// Continue Time Delay
function continueDelay() {
    svgContainer.select("#circle").attr("display", "none");
    svgContainer.select("#triangle").attr("display", "none");
    svgContainer.select("#square").attr("display", "none");
    svgContainer.select("#fixation").attr("display", "block");

    setTimeout(attentionCheck, 1000 * time_remain - 500);
}

// Check the shape
function attentionCheck() {
    gamephase = 4;
	
	// reset categoryStarted flag to false ot help with gamestate 5 settinh
	categoryStarted = false
	
    document.addEventListener('keydown', handleKeyPress);

    // Display the check1 and check2 prompts
    svgContainer.select("#fixation").attr("display", "none");
    svgContainer.select("#check1").attr("display", "block");
    // svgContainer.select("#check2").attr("display", "block");
    // svgContainer.select("#press").attr("display", "block");
    svgContainer.select("#total2")
        .text('Total Score: ' + totalscore)
        .attr("display", "block");

    svgContainer.select("#prepare").attr("display", "none");
    svgContainer.select("#attention").attr("display", "none");
    svgContainer.select("#circle").attr("display", "none");
    svgContainer.select("#triangle").attr("display", "none");
    svgContainer.select("#square").attr("display", "none");

    setTimeout(attentionResponse, 1000 * question_time - 500);
}

function attentionResponse() {
    if (Fail) {
        if (continueFail){
            totalscore = totalscore - minus;
            money = totalscore * 0.05;

            if (money < 0) {
                money = 0;
            }

            subjTrials.minusscore = minus;

            svgContainer.select("#total2").text('Total Score: ' + totalscore);
            svgContainer.select("#total").text('Total Score: ' + totalscore);

            svgContainer.select("#wrong").attr("display", "block");
            svgContainer.select("#minus")
                .text('- ' + minus)
                .attr("display", "block");
                
            minus = minus + 20;
        }

        else {
            minus = 10;
            subjTrials.minusscore = minus;

            totalscore = totalscore - minus;
            money = totalscore * 0.05;


            if (money < 0) {
                money = 0;
            }

            continueFail = true;

            svgContainer.select("#total2").text('Total Score: ' + totalscore);
            svgContainer.select("#total").text('Total Score: ' + totalscore);
            svgContainer.select("#wrong").attr("display", "block");
            svgContainer.select("#minus")
                .text('- ' + minus)
                .attr("display", "block");

            minus = minus + 20;
        }
    }

    else {
        subjTrials.minusscore = 0;
        svgContainer.select("#correct").attr("display", "block");
    }

    setTimeout(nextTrial, 500);
}

// Function to start recording and recognizing speech
function startRecording() {
    csvContent = "Word,Time\n";

    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
            mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            audioChunks = []; // Reset the audio chunks
            mediaRecorder.ondataavailable = event => {
                audioChunks.push(event.data);
            };
            mediaRecorder.onstop = () => {
                let audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                // Upload for both PATA trials (gamephase 0 / 0.5) and main task (gamephase >= 3)
                if (gamephase >= 3 || gamephase === 0 || gamephase === 0.5) {
                    uploadAudio(audioBlob);
                }
                console.log('Recording stopped');
            };
            mediaRecorder.start();
            console.log('Recording started');

            // Initialize speech recognition
            recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
            recognition.lang = 'en-US';
            recognition.interimResults = false; // Only final results
            recognition.continuous = true;

            recognition.onresult = event => {
                let transcript = event.results[event.resultIndex][0].transcript.trim();
                // let combinedPhrases = processTranscript(transcript); // Process with compromise
                let words = transcript.split(' '); // Split the transcript into individual words
                let transdate = new Date();
                let time = transdate - startdate;

                // Append each word with the time to CSV content
                words.forEach(word => {
                    csvContent += `${word},${time}\n`;
                    console.log(`Recognized: ${word} at ${time}`);
                });
                
            };

            recognition.onerror = error => {
                console.error('Speech recognition error:', error);
            };
            
            // Start speech recognition
            recognition.start();
            isRecording = true;
            console.log('Speech recognition started');
        })
        .catch(error => {
            console.error('Error accessing audio:', error);
        });
}

// Function to stop recording and recognizing speech
function stopRecording() {
    if (isRecording) {
        mediaRecorder.stop();
        recognition.stop();
        if (gamephase >= 3) {
            saveCSV();
        }
        isRecording = false;
    }
}

// Function to save the CSV file
function saveCSV() {
    const storageRef = firebase.storage().ref();
    const fileName = `${subject.id}-${categoryname}-${Date.now()}.csv`;
    const csvRef = storageRef.child(`transcripts/${subject.id}/${fileName}`);

    // Convert CSV content to Blob
    const csvBlob = new Blob([csvContent], { type: 'text/csv' });

    // Save to local disk immediately before attempting Firebase
    if (window.LocalSink) { LocalSink.sendFile(csvBlob, fileName, subject.id, 'transcript'); }
    if (window.DiskWriter) { DiskWriter.writeTranscript(csvBlob, fileName, subject.id); }

    // Start the upload task
    const uploadTask = csvRef.put(csvBlob);

    uploadTask.on('state_changed',
        function (snapshot) {
            // Handle upload progress
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            console.log('Upload is ' + progress + '% done');
        },
        function (error) {
            // Handle upload errors
            console.error('Upload failed:', error);
        },
        function () {
            // Handle successful upload
            uploadTask.snapshot.ref.getDownloadURL().then(function (downloadURL) {
                console.log('CSV file saved and available at', downloadURL);
            });
        }
    );
}

// Function to upload audio (as in your existing code)
function uploadAudio(audioBlob) {
    const storageRef = firebase.storage().ref();
    const fileName = `${subject.id}-${categoryname}-${Date.now()}.webm`;
    const audioRef = storageRef.child(`audio-recordings/${subject.id}/${fileName}`);

    // Save to local disk immediately before attempting Firebase
    if (window.LocalSink) { LocalSink.sendFile(audioBlob, fileName, subject.id, 'audio'); }
    if (window.DiskWriter) { DiskWriter.writeAudio(audioBlob, fileName, subject.id); }

    const uploadTask = audioRef.put(audioBlob);
    uploadTask.on('state_changed',
        snapshot => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            console.log('Upload is ' + progress + '% done');
        },
        error => {
            console.error('Upload failed:', error);
        },
        () => {
            uploadTask.snapshot.ref.getDownloadURL().then(downloadURL => {
                console.log('Audio upload successful! File available at', downloadURL);
            });
        }
    );
}

// Function to process transcript using compromise
function processTranscript(transcript) {
    let doc = nlp(transcript);
    // Extract and combine phrases
    let combinedPhrases = doc.match('#Noun+').out('text');
    return combinedPhrases.trim();  // Trim whitespace
}

function nextpractice(){
    document.addEventListener('keydown', handleKeyPress);

    svgContainer.select("#delay").attr("display", "none");
    svgContainer.select("#prepare").attr("display", "none");
    svgContainer.select("#attention").attr("display", "none");
    svgContainer.select("#fixation").attr("display", "none");

    score = 0;
    isInDelay = false;
    practiceTrial++;

    // End practice if all trials done OR if the 5-minute budget is used up
    if (practiceTrial > 4 || (practiceStartTime !== null && Date.now() - practiceStartTime >= totalPracticeTime)) {
        gamephase = 2;
        startTrial();
    } else {
        // More practice trials remaining and time left in the budget
        gamephase = 1;
        practicetrial();
    }
}


function nextTrial(){

    // If endBlock/endGame already fired (e.g. the d3 timer elapsed while this
    // setTimeout was pending in the travel delay), don't do anything further.
    if (blockTransitionInProgress) {
        console.log("nextTrial: block transition already in progress, skipping");
        return;
    }

    svgContainer.select("#category").attr("display", "none");
    svgContainer.select("#score").attr("display", "none");
    svgContainer.select("#enter").attr("display", "none");
    svgContainer.select("#delay").attr("display", "none");
    svgContainer.select("#prepare").attr("display", "none");
    svgContainer.select("#attention").attr("display", "none");
    svgContainer.select("#circle").attr("display", "none");
    svgContainer.select("#triangle").attr("display", "none");

    subjTrials.experimentID = experiment_ID;
    subjTrials.id = subject.id.concat(trial.toString());
    subjTrials.name = subject.id;
    screen_height = window.screen.availHeight;
    screen_width = window.screen.availWidth;

    subjTrials.score = score;
    subjTrials.time = time;
    subjTrials.trialNum = trial;
    subjTrials.categoryname = categoryname;
    subjTrials.totalscore = totalscore;

    // Increment the trial count
    trial += 1;
    counter += 1;
    subject.currTrial = trial;
    isInDelay = false;
    Fail = true;

    recordTrialSubj(trialcollection, subjTrials);
    createSubject(subjectcollection, subject);


	if (counter == totalTrials/2 ) {
        // Checks whether the experiment is complete, if not continues to next trial

		// SHRUTHI : NEED TO ADD A endBlock function 
		document.addEventListener('keydown', handleKeyPress);
        endBlock();
    } else if (counter == totalTrials){
        // Checks whether the experiment is complete, if not continues to next trial
        document.exitPointerLock();
		
		// SHRUTHI : NEED TO ADD A endBlock function 
        endGame();
    } else {
        d3.select('#total').text('Total Score: ' + totalscore);
        d3.select('#time').text('Time left:  ' + time);

    subjTrials = {
        id: null,
        name: null,
        experimentID: null,
        startTime: [],
        switchTime: [],
        scoreTime: [],
        trialNum: [],
        categoryname: [],
        score: [],
        totalscore: [],
        minusscore:[],
        time:[],
        partshape:[],
        partshapeNum:[],
        trueshape:[],
        trueshapeNum:[],
        result:[],
        money:[],
    };

    startCategory();
    
    } 
	
}


// Function to start the game
function startGame() {
    target_files = "tgt_files/" +subject.condition; //"/category_order_from_pilot.json";
    fileName = target_files;
    console.log(fileName);
    subject.tgt_file = fileName;
    subjTrials.group_type = "null";
    $.getJSON(fileName, function (json) {
        target_file_data = json;
        gameSetup(target_file_data);
    });
}

// Function to end early
function endEarly() {

    closeFullScreen();
    $('html').css('cursor', 'auto');
    $('body').css('cursor', 'auto');
    $('body').css('background-color', 'white');
    $('html').css('background-color', 'white');

    d3.select('#category').attr('display', 'none');
    d3.select('#score').attr('display', 'none');
    d3.select('#total').attr('display', 'none');
    d3.select('#time').attr('display', 'none');

    svgContainer.select("#check1").attr("display", "none");
    svgContainer.select("#check2").attr("display", "none");
    svgContainer.select("#total2").attr("display", "none");
    svgContainer.select("#correct").attr("display", "none");
    svgContainer.select("#wrong").attr("display", "none");
    svgContainer.select("#minus").attr("display", "none");
    svgContainer.select("#press").attr("display", "none");
    show('container-failed', 'container-exp');
}

// Function that ends the furst block appropriately; mirroring the within subject design of physical foraging

function endBlock() {
    console.log("travel_time_index =", travel_time_index)
	if (blockTransitionInProgress) { console.log("endBlock: already in transition, skipping"); return; }
	blockTransitionInProgress = true;
	// closeFullScreen();
	console.log ("ENTERING endBlock Function")
    $('html').css('cursor', 'auto');
    $('body').css('cursor', 'auto');
    $('body').css('background-color', 'white');
    $('html').css('background-color', 'white');

	svgContainer.select("#money").attr("display", "none")
    svgContainer.select("#delay").attr("display", "none");
    svgContainer.select("#prepare").attr("display", "none");
    svgContainer.select("#attention").attr("display", "none");
    svgContainer.select("#fixation").attr("display", "none");

    d3.select('#category').attr('display', 'none');
    d3.select('#score').attr('display', 'none');
    d3.select('#total').attr('display', 'none');
    d3.select('#time').attr('display', 'none');

    d3.select("#check1").attr("display", "none");
    d3.select("#check2").attr("display", "none");
    d3.select("#total2").attr("display", "none");
    d3.select("#correct").attr("display", "none");
    d3.select("#wrong").attr("display", "none");
    d3.select("#minus").attr("display", "none");
    d3.select("#press").attr("display", "none");
	d3.select("#enter").attr("display", "none");
	
	// at soem point consider creating a new svg container added to endblock div 
	// show('container-end-block', 'container-exp');
	svgContainer.select("#instruc1_end_block").attr("display", "block");
	svgContainer.select("#instruc2").attr("display", "block") // press spacebar instruction
	svgContainer.select("#money")
	    .attr("display", "none")
	    .text('You have earned $' + money + ' !');
	
 	// reset trial Number
	blockTimerGeneration++; // invalidate the current block d3 timer immediately
	gamephase = 5
	totalscore = 0;
	trial = 1;
	counter = target_file_data.numtrials/2;
	isInDelay = false
	categoryStarted = false
	blockEnd = true;
	travel_time_index += 1
	// Re-attach key listener in case showMoney() removed it (e.g. timer fired during travel delay)
	document.addEventListener('keydown', handleKeyPress);
}

// Function that ends the game appropriately after the experiment has been completed
function endGame() {
	if (blockTransitionInProgress) { console.log("endGame: already in transition, skipping"); return; }
	blockTransitionInProgress = true;

    closeFullScreen();

    $('html').css('cursor', 'auto');
    $('body').css('cursor', 'auto');
    $('body').css('background-color', 'white');
    $('html').css('background-color', 'white');

    svgContainer.select("#money")
        .attr("display", "none")
        .text('You have earned $' + money + ' !');

    svgContainer.select("#delay").attr("display", "none");
    svgContainer.select("#prepare").attr("display", "none");
    svgContainer.select("#attention").attr("display", "none");
    svgContainer.select("#fixation").attr("display", "none");

    d3.select('#category').attr('display', 'none');
    d3.select('#score').attr('display', 'none');
    d3.select('#total').attr('display', 'none');
    d3.select('#time').attr('display', 'none');

    d3.select("#check1").attr("display", "none");
    d3.select("#check2").attr("display", "none");
    d3.select("#total2").attr("display", "none");
    d3.select("#correct").attr("display", "none");
    d3.select("#wrong").attr("display", "none");
    d3.select("#minus").attr("display", "none");
    d3.select("#press").attr("display", "none");

    setTimeout(function(){
		show('container-not-an-ad', 'container-exp');
	}, 10000);
}

document.addEventListener('DOMContentLoaded', function () {
    // // 🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥
    // // The Firebase SDK is initialized and available here!
    //
    // firebase.auth().onAuthStateChanged(user => { });
    // firebase.database().ref('/path/to/ref').on('value', snapshot => { });
    // firebase.messaging().requestPermission().then(() => { });
    // firebase.storage().ref('/path/to/ref').getDownloadURL().then(() => { });
    //
    // // 🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥
});