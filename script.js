// Encapsulate the script in an IIFE to avoid polluting the global scope
(() => {
    // --- STATE MANAGEMENT ---
    let state = {
        questions: [],
        currentQuestionIndex: 0,
        userAnswers: [],
        timerInterval: null,
        timeLeft: 3600, // Default value, will be updated on exam start
        isExamSubmitted: false,
        selectedSubjectFile: '',
        examDuration: 3600 // Default duration
    };

    // --- CONFIGURATION ---
    const config = {
        // Centralize Tailwind classes for easier updates
        classes: {
            nextButton: ['bg-blue-600', 'hover:bg-blue-700'],
            submitButton: ['bg-green-600', 'hover:bg-green-700'],
            navCurrent: ['bg-blue-600', 'text-white', 'hover:bg-blue-700'],
            navAnswered: ['bg-green-200', 'dark:bg-green-800', 'text-green-800', 'dark:text-green-200', 'hover:bg-green-300', 'dark:hover:bg-green-700'],
            navUnanswered: ['bg-gray-200', 'dark:bg-gray-700', 'text-gray-800', 'dark:text-white', 'hover:bg-gray-300', 'dark:hover:bg-gray-600']
        }
    };

    // --- DOM ELEMENT CACHING ---
    const DOMElements = {
        subjectSelectionSection: document.getElementById('subject-selection-section'),
        subjectSelect: document.getElementById('subject-select'),
        timerSelect: document.getElementById('timer-select'),
        startExamButton: document.getElementById('start-exam-button'),
        examSection: document.getElementById('exam-section'),
        questionText: document.getElementById('question-text'),
        optionsContainer: document.getElementById('options-container'),
        currentQuestionNumberSpan: document.getElementById('current-question-number'),
        totalQuestionsSpan: document.getElementById('total-questions'),
        prevButton: document.getElementById('prev-button'),
        nextButton: document.getElementById('next-button'),
        timerDisplay: document.getElementById('timer'),
        questionNavGrid: document.getElementById('question-nav-grid'),
        resultsSection: document.getElementById('results-section'),
        scoreDisplay: document.getElementById('score-display'),
        answersBreakdown: document.getElementById('answers-breakdown'),
        retakeExamButton: document.getElementById('retake-exam-button'),
        darkModeToggle: document.getElementById('darkModeToggle'),
        sunIcon: document.getElementById('sun-icon'),
        moonIcon: document.getElementById('moon-icon'),
        fullscreenToggle: document.getElementById('fullscreenToggle'),
        expandIcon: document.getElementById('expand-icon'),
        compressIcon: document.getElementById('compress-icon'),
        html: document.documentElement
    };

    // --- UI & THEME FUNCTIONS ---

    const toggleDarkMode = () => {
        DOMElements.html.classList.toggle('dark');
        const isDarkMode = DOMElements.html.classList.contains('dark');
        localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
        DOMElements.sunIcon.classList.toggle('hidden', isDarkMode);
        DOMElements.moonIcon.classList.toggle('hidden', !isDarkMode);
    };

    const applyThemePreference = () => {
        const savedTheme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
            DOMElements.html.classList.add('dark');
            DOMElements.sunIcon.classList.add('hidden');
            DOMElements.moonIcon.classList.remove('hidden');
        } else {
            DOMElements.html.classList.remove('dark');
            DOMElements.sunIcon.classList.remove('hidden');
            DOMElements.moonIcon.classList.add('hidden');
        }
    };

    const toggleFullScreen = () => {
        if (!document.fullscreenElement) {
            DOMElements.html.requestFullscreen().catch(err => console.error(`Fullscreen request failed: ${err.message}`));
        } else {
            document.exitFullscreen().catch(err => console.error(`Exit fullscreen failed: ${err.message}`));
        }
    };

    const updateFullScreenIcon = () => {
        const isFullscreen = !!document.fullscreenElement;
        DOMElements.expandIcon.classList.toggle('hidden', isFullscreen);
        DOMElements.compressIcon.classList.toggle('hidden', !isFullscreen);
    };

    // --- CORE EXAM LOGIC ---

    const fetchQuestions = async (filePath) => {
        try {
            const response = await fetch(filePath);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            state.questions = await response.json();
            initializeExam();
        } catch (error) {
            console.error('Could not fetch questions:', error);
            DOMElements.examSection.innerHTML = `<p class="text-red-600 dark:text-red-400 text-center text-xl font-semibold">Failed to load exam questions. Please try again later.</p>`;
            DOMElements.examSection.classList.remove('hidden');
            DOMElements.subjectSelectionSection.classList.add('hidden');
        }
    };

    const initializeExam = () => {
        state.userAnswers = Array(state.questions.length).fill(null);
        DOMElements.subjectSelectionSection.classList.add('hidden');
        DOMElements.examSection.classList.remove('hidden');
        generateQuestionNavGrid();
        loadQuestion();
        startTimer();
    };

    const loadQuestion = () => {
        if (state.isExamSubmitted || state.questions.length === 0) return;

        const question = state.questions[state.currentQuestionIndex];
        DOMElements.questionText.textContent = question.question;

        DOMElements.currentQuestionNumberSpan.textContent = state.currentQuestionIndex + 1;
        DOMElements.totalQuestionsSpan.textContent = state.questions.length;

        // More efficient DOM creation using a single innerHTML update
        const optionsHTML = question.options.map((option, index) => {
            const optionId = `q${state.currentQuestionIndex}-option${index}`;
            const isChecked = state.userAnswers[state.currentQuestionIndex] === option;
            const escapedOption = option.replace(/"/g, "&quot;"); // Escape quotes in option value
            return `
                <div class="flex items-center p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-800 cursor-pointer transition duration-200" onclick="document.getElementById('${optionId}').click()">
                    <input type="radio" id="${optionId}" name="question-${state.currentQuestionIndex}" value="${escapedOption}" class="mr-3" ${isChecked ? 'checked' : ''} onchange="saveCurrentAnswer()">
                    <label for="${optionId}" class="text-lg text-gray-800 dark:text-gray-100 flex-grow cursor-pointer">${String.fromCharCode(65 + index)}. ${option}</label>
                </div>
            `;
        }).join('');

        DOMElements.optionsContainer.innerHTML = optionsHTML;

        updateNavigationButtons();
        updateQuestionNavGrid();
    };

    // Make function globally accessible for inline event handlers
    window.saveCurrentAnswer = () => {
        const selectedOption = document.querySelector(`input[name="question-${state.currentQuestionIndex}"]:checked`);
        state.userAnswers[state.currentQuestionIndex] = selectedOption ? selectedOption.value : null;
        updateQuestionNavGrid();
    };

    const updateNavigationButtons = () => {
        DOMElements.prevButton.disabled = state.currentQuestionIndex === 0;

        const isLastQuestion = state.currentQuestionIndex === state.questions.length - 1;
        DOMElements.nextButton.textContent = isLastQuestion ? 'Submit Exam' : 'Next';
        DOMElements.nextButton.classList.remove(...config.classes.nextButton, ...config.classes.submitButton);
        DOMElements.nextButton.classList.add(...(isLastQuestion ? config.classes.submitButton : config.classes.nextButton));
    };

    const handleNext = () => {
        if (state.currentQuestionIndex < state.questions.length - 1) {
            state.currentQuestionIndex++;
            loadQuestion();
        } else {
            submitExam();
        }
    };

    const handlePrevious = () => {
        if (state.currentQuestionIndex > 0) {
            state.currentQuestionIndex--;
            loadQuestion();
        }
    };

    const startTimer = () => {
        clearInterval(state.timerInterval);
        state.timeLeft = state.examDuration;

        // Function to update the timer display
        const updateDisplay = () => {
            const minutes = Math.floor(state.timeLeft / 60);
            const seconds = state.timeLeft % 60;
            DOMElements.timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        };

        updateDisplay(); // Update display immediately on start

        state.timerInterval = setInterval(() => {
            state.timeLeft--;
            updateDisplay();
            if (state.timeLeft <= 0) {
                clearInterval(state.timerInterval);
                submitExam();
            }
        }, 1000);
    };

    const submitExam = () => {
        if (state.isExamSubmitted) return;
        state.isExamSubmitted = true;
        clearInterval(state.timerInterval);

        let score = 0;
        const answersBreakdownHTML = state.questions.map((question, index) => {
            const userAnswer = state.userAnswers[index];
            const isCorrect = userAnswer === question.correctAnswer;
            if (isCorrect) score++;

            return `
                <div class="p-4 rounded-lg shadow-sm ${isCorrect ? 'bg-green-50 dark:bg-green-900' : 'bg-red-50 dark:bg-red-900'}">
                    <p class="font-semibold text-gray-900 dark:text-white text-lg mb-1">Q${index + 1}: ${question.question}</p>
                    <p class="text-gray-700 dark:text-gray-200">Your Answer: <span class="${isCorrect ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'} font-medium">${userAnswer || 'Not Answered'}</span></p>
                    <p class="text-gray-700 dark:text-gray-200">Correct Answer: <span class="text-blue-600 dark:text-blue-400 font-medium">${question.correctAnswer}</span></p>
                </div>
            `;
        }).join('');

        DOMElements.answersBreakdown.innerHTML = answersBreakdownHTML;
        DOMElements.scoreDisplay.textContent = `You scored ${score} out of ${state.questions.length}!`;
        DOMElements.examSection.classList.add('hidden');
        DOMElements.resultsSection.classList.remove('hidden');
    };

    const retakeExam = () => {
        state.currentQuestionIndex = 0;
        state.userAnswers = [];
        state.isExamSubmitted = false;
        state.selectedSubjectFile = '';
        DOMElements.resultsSection.classList.add('hidden');
        DOMElements.subjectSelectionSection.classList.remove('hidden');
        DOMElements.subjectSelect.value = '';
        DOMElements.startExamButton.disabled = true;
        DOMElements.questionNavGrid.innerHTML = '';
        // Reset timer display to default
        const defaultDuration = parseInt(DOMElements.timerSelect.value, 10);
        const minutes = Math.floor(defaultDuration / 60);
        const seconds = defaultDuration % 60;
        DOMElements.timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };

    const generateQuestionNavGrid = () => {
        const gridHTML = state.questions.map((_, index) =>
            `<button class="w-10 h-10 flex items-center justify-center rounded-lg font-semibold transition duration-200 shadow-sm" data-nav-index="${index}">${index + 1}</button>`
        ).join('');
        DOMElements.questionNavGrid.innerHTML = gridHTML;
    };

    const updateQuestionNavGrid = () => {
        const qButtons = DOMElements.questionNavGrid.children;
        for (let i = 0; i < qButtons.length; i++) {
            const button = qButtons[i];
            button.className = 'w-10 h-10 flex items-center justify-center rounded-lg font-semibold transition duration-200 shadow-sm';

            if (i === state.currentQuestionIndex) {
                button.classList.add(...config.classes.navCurrent);
            } else if (state.userAnswers[i] !== null) {
                button.classList.add(...config.classes.navAnswered);
            } else {
                button.classList.add(...config.classes.navUnanswered);
            }
        }
    };

    const navigateToQuestion = (index) => {
        state.currentQuestionIndex = index;
        loadQuestion();
    }

    // --- EVENT LISTENERS ---

    const setupEventListeners = () => {
        DOMElements.darkModeToggle.addEventListener('click', toggleDarkMode);
        DOMElements.fullscreenToggle.addEventListener('click', toggleFullScreen);
        document.addEventListener('fullscreenchange', updateFullScreenIcon);

        DOMElements.subjectSelect.addEventListener('change', () => {
            state.selectedSubjectFile = DOMElements.subjectSelect.value;
            DOMElements.startExamButton.disabled = !state.selectedSubjectFile;
        });

        DOMElements.startExamButton.addEventListener('click', () => {
            if (state.selectedSubjectFile) {
                // Set the exam duration from the dropdown when the exam starts
                state.examDuration = parseInt(DOMElements.timerSelect.value, 10);
                fetchQuestions(state.selectedSubjectFile);
            }
        });

        DOMElements.nextButton.addEventListener('click', handleNext);
        DOMElements.prevButton.addEventListener('click', handlePrevious);
        DOMElements.retakeExamButton.addEventListener('click', retakeExam);

        // Delegated event listener for dynamically created content
        DOMElements.questionNavGrid.addEventListener('click', (event) => {
            const navButton = event.target.closest('button[data-nav-index]');
            if (navButton) {
                const index = parseInt(navButton.dataset.navIndex, 10);
                navigateToQuestion(index);
            }
        });
    };

    // --- INITIALIZATION ---
    applyThemePreference();
    DOMElements.startExamButton.disabled = true;
    setupEventListeners();

})();