import type { McLevel, McResource } from "@/lib/mc-types";

/*
 * The machine-coding curriculum. Three levels, each a list of phases, each a list of items.
 * Only links that were opened and confirmed to exist are used. Where the uploader or the spoken
 * language of a video is not confirmed, the resource carries a `note` saying so.
 */

const LLD_REPO = "https://github.com/ashishps1/awesome-low-level-design";
const CODER_ARMY_PLAYLIST = "https://www.youtube.com/playlist?list=PLQEaRBV9gAFvzp6XhcNFpk1WdOcyVo9qT";
const OKHRAVI_PLAYLIST = "https://www.youtube.com/playlist?list=PLrhzvIcii6GNjpARdnO4ueTUAVR9eMBpc";
const yt = (id: string) => `https://www.youtube.com/watch?v=${id}`;
const guru = (slug: string) => `https://refactoring.guru/design-patterns/${slug}`;

const lldProblems: McResource = {
  label: "Problem statements and class diagrams (awesome-low-level-design)",
  url: `${LLD_REPO}/tree/main/problems`,
  kind: "read",
};
const lldPython: McResource = {
  label: "Reference solutions in Python",
  url: `${LLD_REPO}/tree/main/solutions/python`,
  kind: "code",
  lang: "python",
  note: "Check the folder for this problem. Not every problem is filled in for every language.",
};
const lldCpp: McResource = {
  label: "Reference solutions in C++",
  url: `${LLD_REPO}/tree/main/solutions/cpp`,
  kind: "code",
  lang: "cpp",
  note: "Check the folder for this problem. Not every problem is filled in for every language.",
};
const series = (title: string): McResource => ({
  label: `Coder Army LLD playlist: find "${title}"`,
  url: CODER_ARMY_PLAYLIST,
  kind: "video",
  lang: "java",
  note: "Java code. Watch for the idea and write your own in Python or C++.",
});
const pattern = (label: string, slug: string): McResource => ({
  label: `Refactoring Guru: ${label}`,
  url: guru(slug),
  kind: "read",
});

export const MC_LEVELS: McLevel[] = [
  {
    id: "sde1",
    name: "SDE-1",
    tagline: "Think in objects, then build your first complete systems.",
    weeks: "About 5 weeks",
    know: [
      "Model a small domain with classes, interfaces and the right relationships",
      "Spot a violation of each SOLID principle in your own code",
      "Choose between Strategy, State, Factory, Observer, Singleton, Decorator and Builder for a given requirement",
      "Run the 90-minute routine: requirements, design, runnable code, a driver that proves it works",
      "Finish eleven problems with validation, exceptions and an extensible design, including one you had never seen",
    ],
    phases: [
      {
        id: "s1-oop",
        title: "OOP foundations",
        blurb: "Everything later rests on these. Write the small exercise after each video before moving on.",
        gate: "I can model a small domain (a library) with classes, interfaces and composition, and explain each choice.",
        items: [
          {
            id: "s1-oop-pillars",
            kind: "concept",
            title: "Classes, encapsulation, abstraction",
            summary:
              "What belongs inside a class, what stays private, and why. Model a Library with books, members and loans.",
            minutes: 55,
            resources: [
              {
                label: "OOPs Real-World Examples (Coder Army LLD)",
                url: yt("QbGoqAgP_zg"),
                kind: "video",
                lang: "java",
                note: "Java code. Uploader inferred from the playlist.",
              },
            ],
          },
          {
            id: "s1-oop-inherit",
            kind: "concept",
            title: "Inheritance and polymorphism",
            summary:
              "When a subclass is honest and when it is a trap. Replace a type check in your Library with polymorphism.",
            minutes: 45,
            resources: [
              {
                label: "Inheritance & Polymorphism in OOPs (Coder Army LLD)",
                url: yt("KGOEK0-XBIg"),
                kind: "video",
                lang: "java",
              },
            ],
          },
          {
            id: "s1-oop-compose",
            kind: "concept",
            title: "Composition over inheritance, and class relationships",
            summary:
              "Association, aggregation, composition and dependency, and when to prefer holding an object over extending one.",
            minutes: 40,
            resources: [
              lldProblems,
              {
                label: "Awesome LLD: the class diagrams folder",
                url: `${LLD_REPO}/tree/main/class-diagrams`,
                kind: "read",
              },
            ],
          },
        ],
      },
      {
        id: "s1-principles",
        title: "UML and SOLID",
        blurb: "Draw before you code, and learn the vocabulary that interviewers grade you on.",
        gate: "I can point at a violation of each SOLID principle in code I wrote and show the fix.",
        items: [
          {
            id: "s1-uml",
            kind: "concept",
            title: "UML: class and sequence diagrams",
            summary: "Draw the Library as a class diagram and one sequence diagram for borrowing a book.",
            minutes: 72,
            resources: [
              {
                label: "UML Diagrams, Class & Sequence (Coder Army LLD)",
                url: yt("nPJyyO9pb5s"),
                kind: "video",
                lang: "java",
              },
            ],
          },
          {
            id: "s1-solid",
            kind: "concept",
            title: "SOLID principles",
            summary:
              "All five, with a bad and a good version of each. Then find one violation of each in your Library code.",
            minutes: 90,
            resources: [
              {
                label: "SOLID Design Principles, complete guide (Coder Army LLD)",
                url: yt("UsNl8kcU4UA"),
                kind: "video",
                lang: "java",
              },
              {
                label: "Uncle Bob's SOLID Principles Made Easy, in Python (ArjanCodes)",
                url: yt("pTB30aXS77U"),
                kind: "video",
                lang: "python",
              },
            ],
          },
          {
            id: "s1-clean",
            kind: "concept",
            title: "DRY, KISS, YAGNI, coupling and cohesion",
            summary:
              "The small rules that keep a design honest, and the ones that stop you over-building in a timed round.",
            minutes: 30,
            resources: [
              {
                label: "Where to find these: the Design Principles list in awesome-low-level-design",
                url: LLD_REPO,
                kind: "read",
              },
            ],
          },
        ],
      },
      {
        id: "s1-patterns",
        title: "The seven patterns that matter",
        blurb: "Learn each from a video, read the catalog page, then implement it yourself in your language.",
        gate: "Given a small requirement, I can name the right pattern and the one that only looks right.",
        items: [
          {
            id: "s1-p-strategy",
            kind: "pattern",
            title: "Strategy",
            summary:
              "Swap an algorithm at runtime. Pricing in a parking lot, split types in Splitwise, rate-limit algorithms.",
            minutes: 45,
            resources: [series("Strategy Design Pattern"), pattern("Strategy", "strategy")],
          },
          {
            id: "s1-p-state",
            kind: "pattern",
            title: "State",
            summary:
              "Behaviour that depends on the current state. Vending machines, ATMs, order lifecycles. Compare it with Strategy.",
            minutes: 45,
            resources: [
              {
                label: "Okhravi: Design Patterns in OOP (find State)",
                url: OKHRAVI_PLAYLIST,
                kind: "video",
                lang: "java",
                note: "Uploader inferred from search results.",
              },
              pattern("State", "state"),
            ],
          },
          {
            id: "s1-p-factory",
            kind: "pattern",
            title: "Factory (simple and method)",
            summary:
              "Hide which concrete class gets built. Vehicles, payment methods, notification channels.",
            minutes: 40,
            resources: [series("Factory Design Pattern"), pattern("Factory Method", "factory-method")],
          },
          {
            id: "s1-p-observer",
            kind: "pattern",
            title: "Observer",
            summary: "One change, many listeners. Notifications, pub-sub, order status updates.",
            minutes: 40,
            resources: [series("Observer Design Pattern"), pattern("Observer", "observer")],
          },
          {
            id: "s1-p-singleton",
            kind: "pattern",
            title: "Singleton, and why it is overused",
            summary:
              "One shared instance, including a thread-safe version. Know when a plain module-level object is simpler.",
            minutes: 30,
            resources: [series("Singleton Design Pattern"), pattern("Singleton", "singleton")],
          },
          {
            id: "s1-p-decorator",
            kind: "pattern",
            title: "Decorator",
            summary: "Add behaviour by wrapping. Pizza toppings, coffee add-ons, request middleware.",
            minutes: 30,
            resources: [series("Decorator Pattern Explained"), pattern("Decorator", "decorator")],
          },
          {
            id: "s1-p-builder",
            kind: "pattern",
            title: "Builder",
            summary: "Build objects with many optional fields without a giant constructor.",
            minutes: 25,
            resources: [pattern("Builder", "builder")],
          },
        ],
      },
      {
        id: "s1-method",
        title: "The machine-coding method",
        blurb: "Learn the routine once. Every problem after this uses it.",
        gate: "I can run the 90-minute routine on a problem I have never seen, and my code runs at the end.",
        items: [
          {
            id: "s1-m-routine",
            kind: "method",
            title: "The 90-minute routine",
            summary:
              "10 minutes of requirements and scope, 15 of design, about 55 of code, 10 of testing with a driver. Write down what you leave out.",
            minutes: 30,
            resources: [
              {
                label: "How to answer an LLD problem (linked from awesome-low-level-design)",
                url: LLD_REPO,
                kind: "read",
              },
            ],
          },
          {
            id: "s1-m-entities",
            kind: "method",
            title: "Finding entities, methods and relationships",
            summary:
              "Nouns become classes, verbs become methods. Decide the owner of each rule before you type.",
            minutes: 30,
            resources: [lldProblems],
          },
          {
            id: "s1-m-quality",
            kind: "method",
            title: "Validation, exceptions and a proving driver",
            summary:
              "Reject bad input at the edge, raise specific errors, and finish with a main that runs 5 to 8 scenarios.",
            minutes: 30,
            resources: [],
          },
        ],
      },
      {
        id: "s1-problems",
        title: "Core problems",
        blurb: "Each one is the five-step loop. Start the cold attempt before you open any reference.",
        gate: "I finished most of these inside the time box, extended each with a new requirement, and handled the wildcard cold.",
        items: [
          {
            id: "s1-prob-parking",
            kind: "problem",
            title: "Parking Lot",
            summary: "Floors, spots, vehicles, tickets and pricing. The standard first problem.",
            minutes: 90,
            patterns: ["Strategy", "Factory", "Singleton"],
            resources: [
              lldProblems,
              lldPython,
              lldCpp,
              {
                label: "Parking Lot, UML and code (video)",
                url: yt("RkmO5GRedLo"),
                kind: "video",
                note: "Channel and language not confirmed.",
              },
            ],
          },
          {
            id: "s1-prob-tictactoe",
            kind: "problem",
            title: "Tic Tac Toe",
            summary: "Board, players, win detection that is not hard-coded to 3 by 3.",
            minutes: 90,
            patterns: ["Strategy"],
            resources: [
              lldProblems,
              lldPython,
              lldCpp,
              {
                label: "Tic Tac Toe, UML and code (Coder Army LLD)",
                url: yt("BGFzYjGtRP4"),
                kind: "video",
                lang: "java",
                note: "Uploader inferred from the playlist.",
              },
            ],
          },
          {
            id: "s1-prob-vending",
            kind: "problem",
            title: "Vending Machine",
            summary: "Inventory, coins and a machine that behaves differently in each state.",
            minutes: 90,
            patterns: ["State"],
            resources: [lldProblems, lldPython, lldCpp],
          },
          {
            id: "s1-prob-atm",
            kind: "problem",
            title: "ATM and cash dispenser",
            summary: "Authenticate, withdraw, dispense the right notes. A chain of handlers for the notes.",
            minutes: 90,
            patterns: ["State", "Chain of Responsibility"],
            resources: [
              lldProblems,
              lldPython,
              lldCpp,
              series("Chain of Responsibility Pattern | Build Cash Dispenser"),
            ],
          },
          {
            id: "s1-prob-snake",
            kind: "problem",
            title: "Snake and Ladder",
            summary: "Board, dice, players and jumps. Keep the dice and the board rules swappable.",
            minutes: 90,
            patterns: ["Strategy", "Factory"],
            resources: [
              lldProblems,
              lldPython,
              lldCpp,
              {
                label: "Build Snake and Ladder (Coder Army LLD)",
                url: yt("1NJB54UB8nE"),
                kind: "video",
                lang: "java",
                note: "Uploader inferred from the playlist.",
              },
            ],
          },
          {
            id: "s1-prob-splitwise",
            kind: "problem",
            title: "Splitwise",
            summary:
              "Users, groups, equal, exact and percent splits, and a balance sheet that simplifies debts.",
            minutes: 90,
            patterns: ["Strategy", "Factory"],
            resources: [
              lldProblems,
              lldPython,
              lldCpp,
              {
                label: "Splitwise LLD, UML and code (video)",
                url: yt("syH7axOpqhA"),
                kind: "video",
                note: "Channel and language not confirmed.",
              },
            ],
          },
          {
            id: "s1-prob-lru",
            kind: "problem",
            title: "LRU Cache",
            summary:
              "A hash map plus a linked list, behind an interface that lets you swap the eviction policy.",
            minutes: 90,
            patterns: ["Strategy"],
            resources: [lldProblems, lldPython, lldCpp],
          },
          {
            id: "s1-prob-ratelimiter",
            kind: "problem",
            title: "Rate Limiter",
            summary: "Fixed window, sliding window and token bucket behind one interface.",
            minutes: 90,
            patterns: ["Strategy", "Factory"],
            resources: [lldProblems, lldPython, lldCpp],
          },
          {
            id: "s1-prob-notify",
            kind: "problem",
            title: "Notification Engine",
            summary: "Channels, templates and subscriptions. Observer, Strategy and Factory together.",
            minutes: 90,
            patterns: ["Observer", "Strategy", "Factory"],
            resources: [lldProblems, lldPython, lldCpp, series("Build Your Own Notification Engine")],
          },
          {
            id: "s1-prob-meeting",
            kind: "problem",
            title: "Meeting Scheduler",
            summary: "Rooms, bookings and clashes. Find a free slot and reject overlaps.",
            minutes: 90,
            patterns: ["Strategy"],
            resources: [],
          },
          {
            id: "s1-prob-wildcard",
            kind: "problem",
            title: "Wildcard: a problem you have not seen",
            summary:
              "Pick one that is not on this list, such as Coffee Vending Machine, Traffic Signal Control or Stack Overflow from the easy list, or have someone name one. Same 90 minutes, no reference. This is the real test.",
            minutes: 90,
            patterns: ["Your pick"],
            resources: [lldProblems],
          },
        ],
      },
    ],
  },
  {
    id: "sde2",
    name: "SDE-2",
    tagline: "Designs that survive change, concurrency and real storage.",
    weeks: "About 6 weeks",
    know: [
      "Add Command, Chain of Responsibility, Composite, Adapter, Facade and Template Method when a problem asks for them",
      "Make a design thread-safe, and reason about races, deadlocks and idempotency",
      "Separate storage behind a repository, and know transactions, isolation and optimistic against pessimistic locking",
      "Design for requirements that change halfway through the round",
      "Finish thirteen richer problems, including a concurrent booking system",
    ],
    phases: [
      {
        id: "s2-patterns",
        title: "The second wave of patterns",
        blurb: "Learn these when a problem needs them. Write each once.",
        gate: "I can explain why each of these earned its place in a problem I solved.",
        items: [
          {
            id: "s2-p-command",
            kind: "pattern",
            title: "Command",
            summary: "Requests as objects. Undo and redo, queues of actions, text editors.",
            minutes: 40,
            resources: [series("Command Design Pattern"), pattern("Command", "command")],
          },
          {
            id: "s2-p-chain",
            kind: "pattern",
            title: "Chain of Responsibility",
            summary: "Pass a request along handlers. Validation pipelines, ATM notes, support escalation.",
            minutes: 35,
            resources: [
              series("Chain of Responsibility Pattern"),
              pattern("Chain of Responsibility", "chain-of-responsibility"),
            ],
          },
          {
            id: "s2-p-composite",
            kind: "pattern",
            title: "Composite",
            summary: "Treat one object and a tree of them the same way. File systems, menus, org charts.",
            minutes: 35,
            resources: [
              series("Composite Design Pattern | Build File System"),
              pattern("Composite", "composite"),
            ],
          },
          {
            id: "s2-p-adapter-facade",
            kind: "pattern",
            title: "Adapter and Facade",
            summary: "Wrap a third-party API, or hide a messy subsystem behind one clean entry point.",
            minutes: 50,
            resources: [
              series("Adapter Design Pattern"),
              series("Facade Design Pattern"),
              pattern("Adapter", "adapter"),
              pattern("Facade", "facade"),
            ],
          },
          {
            id: "s2-p-template",
            kind: "pattern",
            title: "Template Method",
            summary: "Fix the skeleton of an algorithm and let subclasses fill in the steps.",
            minutes: 30,
            resources: [series("Template Method Pattern"), pattern("Template Method", "template-method")],
          },
        ],
      },
      {
        id: "s2-concurrency",
        title: "Concurrency",
        blurb:
          "Booking, elevators and queues all fail here first. Learn the vocabulary, then break your own code on purpose.",
        gate: "I can show a race condition in my own code, fix it, and say what the fix costs.",
        items: [
          {
            id: "s2-c-basics",
            kind: "concept",
            title: "Processes, threads and race conditions",
            summary: "Why two threads updating one counter lose updates, and what a critical section is.",
            minutes: 45,
            resources: [
              {
                label: "Concurrency 101 in awesome-low-level-design (links to algomaster.io)",
                url: LLD_REPO,
                kind: "read",
                note: "The lessons live on algomaster.io. Free access was not checked.",
              },
            ],
          },
          {
            id: "s2-c-locks",
            kind: "concept",
            title: "Mutexes, semaphores and condition variables",
            summary:
              "Lock the smallest thing for the shortest time. Coarse against fine-grained locking, and reentrant locks.",
            minutes: 60,
            resources: [
              {
                label: "Synchronization primitives list in awesome-low-level-design",
                url: LLD_REPO,
                kind: "read",
                note: "The lessons live on algomaster.io. Free access was not checked.",
              },
            ],
          },
          {
            id: "s2-c-deadlock",
            kind: "concept",
            title: "Deadlock and how to avoid it",
            summary: "The four conditions, lock ordering, and timeouts with try-lock.",
            minutes: 30,
            resources: [],
          },
          {
            id: "s2-c-prodcons",
            kind: "concept",
            title: "Producer-consumer and thread pools",
            summary: "A blocking queue between the part that produces work and the part that does it.",
            minutes: 45,
            resources: [],
          },
          {
            id: "s2-c-idempotency",
            kind: "concept",
            title: "Idempotency, retries and failure handling",
            summary:
              "Make a payment safe to retry. Backoff, timeouts and what to do when a downstream call fails.",
            minutes: 40,
            resources: [],
          },
        ],
      },
      {
        id: "s2-persistence",
        title: "Persistence and data",
        blurb:
          "Machine-coding rounds use in-memory storage. The design still has to be ready for a database.",
        gate: "I can swap an in-memory repository for a database one without touching the business logic.",
        items: [
          {
            id: "s2-d-repo",
            kind: "concept",
            title: "The repository pattern",
            summary: "Business rules ask a repository for data and never know where it lives.",
            minutes: 40,
            resources: [],
          },
          {
            id: "s2-d-tx",
            kind: "concept",
            title: "Transactions and isolation levels",
            summary: "What dirty, non-repeatable and phantom reads are, and which level stops which.",
            minutes: 50,
            resources: [],
          },
          {
            id: "s2-d-locking",
            kind: "concept",
            title: "Optimistic and pessimistic locking",
            summary: "Version numbers against row locks. The seat-booking problem decides which you pick.",
            minutes: 40,
            resources: [],
          },
          {
            id: "s2-d-observability",
            kind: "concept",
            title: "Logging and observability basics",
            summary: "What to log, at which level, and the three signals: logs, metrics and traces.",
            minutes: 30,
            resources: [],
          },
        ],
      },
      {
        id: "s2-problems",
        title: "Richer problems",
        blurb: "Expect the requirements to grow during the round. Practise extending your own design.",
        gate: "I extended at least five of these with a requirement I had not planned for, without a rewrite.",
        items: [
          {
            id: "s2-prob-elevator",
            kind: "problem",
            title: "Elevator System",
            summary: "Requests, floors, direction and a scheduling policy.",
            minutes: 90,
            patterns: ["State", "Strategy"],
            resources: [lldProblems, lldPython, lldCpp],
          },
          {
            id: "s2-prob-pubsub",
            kind: "problem",
            title: "Pub-Sub System",
            summary: "Topics, publishers, subscribers and delivery.",
            minutes: 90,
            patterns: ["Observer"],
            resources: [lldProblems, lldPython, lldCpp],
          },
          {
            id: "s2-prob-coupon",
            kind: "problem",
            title: "Discount Coupon Engine",
            summary: "Rules that combine, stack and expire. A strong test of extensibility.",
            minutes: 90,
            patterns: ["Strategy", "Chain of Responsibility"],
            resources: [series("Build Discount Coupon Engine")],
          },
          {
            id: "s2-prob-payment",
            kind: "problem",
            title: "Payment Gateway",
            summary: "Methods, retries, idempotency and a clean provider interface.",
            minutes: 90,
            patterns: ["Factory", "Strategy", "Adapter"],
            resources: [
              {
                label: "Build Payment Gateway System (Coder Army LLD)",
                url: yt("36FDqIRBGRg"),
                kind: "video",
                lang: "java",
                note: "Uploader inferred from the playlist.",
              },
            ],
          },
          {
            id: "s2-prob-bms",
            kind: "problem",
            title: "Movie Ticket Booking (BookMyShow)",
            summary: "Shows, seats and temporary holds. Two people want the same seat.",
            minutes: 90,
            patterns: ["Concurrency", "State"],
            resources: [
              lldProblems,
              lldPython,
              lldCpp,
              {
                label: "LLD of BookMyShow (video)",
                url: yt("wCyzvDn3Pp8"),
                kind: "video",
                note: "Channel and language not confirmed.",
              },
            ],
          },
          {
            id: "s2-prob-library",
            kind: "problem",
            title: "Library Management",
            summary: "Catalogue, members, loans, fines and reservations.",
            minutes: 90,
            patterns: ["Observer", "Strategy"],
            resources: [lldProblems, lldPython, lldCpp],
          },
          {
            id: "s2-prob-tasks",
            kind: "problem",
            title: "Task Management (Jira-lite)",
            summary: "Tasks, assignees, a workflow of states and an activity log.",
            minutes: 90,
            patterns: ["State", "Observer"],
            resources: [lldProblems, lldPython, lldCpp],
          },
          {
            id: "s2-prob-logger",
            kind: "problem",
            title: "Logging Framework",
            summary: "Levels, appenders and formatters. Chain and Strategy in one small library.",
            minutes: 90,
            patterns: ["Chain of Responsibility", "Singleton", "Strategy"],
            resources: [lldProblems, lldPython, lldCpp],
          },
          {
            id: "s2-prob-chess",
            kind: "problem",
            title: "Chess",
            summary: "Pieces with their own move rules, a board and turns. Polymorphism does the work.",
            minutes: 90,
            patterns: ["Polymorphism", "Factory"],
            resources: [
              lldProblems,
              lldPython,
              lldCpp,
              {
                label: "Build Chess Game (Coder Army LLD)",
                url: yt("eULHvaMZUks"),
                kind: "video",
                lang: "java",
                note: "Uploader inferred from the playlist.",
              },
            ],
          },
          {
            id: "s2-prob-filesystem",
            kind: "problem",
            title: "File System",
            summary: "Files and folders in a tree, with the same operations on both.",
            minutes: 90,
            patterns: ["Composite"],
            resources: [series("Composite Design Pattern | Build File System")],
          },
          {
            id: "s2-prob-kv",
            kind: "problem",
            title: "In-Memory Key-Value Store",
            summary: "Get, put, delete, expiry and optional persistence behind an interface.",
            minutes: 90,
            patterns: ["Strategy", "Repository"],
            resources: [lldProblems],
          },
          {
            id: "s2-prob-cart",
            kind: "problem",
            title: "Shopping Cart and Checkout",
            summary: "Cart, pricing rules, stock and an order that cannot oversell.",
            minutes: 90,
            patterns: ["Strategy", "Observer"],
            resources: [lldProblems, lldPython, lldCpp],
          },
          {
            id: "s2-prob-rental",
            kind: "problem",
            title: "Car Rental",
            summary: "Inventory, availability over dates, pricing and returns.",
            minutes: 90,
            patterns: ["Strategy", "Factory"],
            resources: [lldProblems, lldPython, lldCpp],
          },
        ],
      },
    ],
  },
  {
    id: "beyond",
    name: "Beyond SDE-2",
    tagline: "Larger systems, and the backend and CS fundamentals that sit under them.",
    weeks: "Ongoing",
    know: [
      "Design a concurrent building block (a cache with expiry, a blocking queue, a scheduler) from first principles",
      "Take a large product and decide which part is worth building in a two-hour round",
      "Connect each design choice to the OS, database or network concept underneath it",
    ],
    phases: [
      {
        id: "b-systems",
        title: "Concurrent building blocks and larger systems",
        blurb: "Pick these when the earlier levels feel comfortable. Scope each down to what you can finish.",
        gate: "I can pick the core of a large product, build only that, and say what I would add next.",
        items: [
          {
            id: "b-prob-ttlcache",
            kind: "problem",
            title: "Thread-Safe Cache with TTL",
            summary: "Expiry, eviction and a lock strategy that does not serialise every read.",
            minutes: 120,
            patterns: ["Concurrency", "Strategy"],
            resources: [lldPython, lldCpp],
          },
          {
            id: "b-prob-blockingq",
            kind: "problem",
            title: "Thread-Safe Blocking Queue",
            summary: "Bounded capacity, producers and consumers, and clean shutdown.",
            minutes: 120,
            patterns: ["Concurrency"],
            resources: [lldPython, lldCpp],
          },
          {
            id: "b-prob-scheduler",
            kind: "problem",
            title: "Job Scheduler",
            summary: "Delayed and recurring jobs, a worker pool, retries and cancellation.",
            minutes: 120,
            patterns: ["Concurrency", "Command"],
            resources: [],
          },
          {
            id: "b-prob-breaker",
            kind: "problem",
            title: "Circuit Breaker",
            summary: "Closed, open and half-open states around a flaky dependency.",
            minutes: 90,
            patterns: ["State"],
            resources: [],
          },
          {
            id: "b-prob-docs",
            kind: "problem",
            title: "Google Docs (document editor)",
            summary: "A document, edits, undo and redo, and what you would do for collaboration.",
            minutes: 120,
            patterns: ["Command", "Observer"],
            resources: [
              {
                label: "Build Google Docs (Coder Army LLD)",
                url: yt("MT9qZFGQXOU"),
                kind: "video",
                lang: "java",
                note: "Uploader inferred from the playlist.",
              },
            ],
          },
          {
            id: "b-prob-spotify",
            kind: "problem",
            title: "Music Player (Spotify)",
            summary: "Library, playlists, a queue and recommendation hooks.",
            minutes: 120,
            patterns: ["Strategy", "Observer"],
            resources: [series("Build Spotify, Music Player App")],
          },
          {
            id: "b-prob-food",
            kind: "problem",
            title: "Food Delivery (Zomato)",
            summary: "Restaurants, orders, delivery assignment and a state machine for the order.",
            minutes: 120,
            patterns: ["State", "Strategy", "Observer"],
            resources: [series("Build Zomato Food Delivery App")],
          },
        ],
      },
      {
        id: "b-fundamentals",
        title: "Backend and CS fundamentals",
        blurb:
          "Revise these through the systems you just built. Use your own notes; none of these links are included on purpose.",
        gate: "For any design choice I made, I can name the OS, database or network concept behind it.",
        items: [
          {
            id: "b-f-os",
            kind: "concept",
            title: "OS: scheduling, memory, synchronisation",
            summary: "Tie each lock and queue you wrote to what the operating system actually does.",
            minutes: 90,
            resources: [],
          },
          {
            id: "b-f-db",
            kind: "concept",
            title: "DBMS: indexes, normalisation, ACID",
            summary: "Why a booking table needs a unique constraint, and what an index costs on writes.",
            minutes: 90,
            resources: [],
          },
          {
            id: "b-f-net",
            kind: "concept",
            title: "Networks: HTTP, TCP, timeouts",
            summary: "What a retry really does on the wire, and why idempotency keys exist.",
            minutes: 60,
            resources: [],
          },
          {
            id: "b-f-hld",
            kind: "concept",
            title: "High-level design basics",
            summary: "Caching, queues, sharding and replication, enough to see where your LLD would sit.",
            minutes: 120,
            resources: [],
          },
        ],
      },
    ],
  },
];

export const MC_PHASES = MC_LEVELS.flatMap((l) => l.phases.map((p) => ({ ...p, levelId: l.id })));
export const MC_ITEMS = MC_LEVELS.flatMap((l) =>
  l.phases.flatMap((p) => p.items.map((i) => ({ ...i, phaseId: p.id, levelId: l.id }))),
);
