// relatix.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { Tables, Text, Number, SelfRef, Entry } from "../src";
import { createTestModel } from "./tests-setup";

// --- Configuration et Modèle de Test Commun ---

// --- Tests ---

describe("Model Definition (.addTables, .populate, .done)", () => {
  it("should define tables with basic types using Typers", () => {
    const model = Tables()
      .addTables({
        Simple: { field1: Text, field2: Number },
      })
      .populate(() => ({
        Simple: { entry1: { field1: "hello", field2: 123 } },
      }))
      .done();

    expect(model.tables).toHaveProperty("Simple");
    expect(model.tables.Simple.ids).toHaveLength(1);
    const entry = Object.values(model.tables.Simple.entities)[0];
    expect(entry.d).toEqual({ field1: "hello", field2: 123 });
  });

  it("should define tables with SelfRef", () => {
    const model = Tables()
      .addTables({
        Nodes: { value: Number, next: SelfRef as typeof SelfRef | null },
      })
      .populate(({ Nodes }) => ({
        Nodes: {
          node1: { value: 1, next: Nodes("node2") },
          node2: { value: 2, next: null },
        },
      }))
      .done();

    expect(model.tables).toHaveProperty("Nodes");
    expect(model.tables.Nodes.ids).toHaveLength(2);
    const node1Id = model.initIds.Nodes.node1;
    const node2Id = model.initIds.Nodes.node2;
    expect(model.tables.Nodes.entities[node1Id].d.next).toEqual({
      $table: "Nodes",
      id: node2Id,
    });
    expect(model.tables.Nodes.entities[node2Id].d.next).toBeNull();
  });

  it("should define tables referencing other tables using Ref() callback", () => {
    const model = createTestModel().done();

    expect(model.tables).toHaveProperty("People");
    expect(model.tables).toHaveProperty("Projects");
    expect(model.tables).toHaveProperty("Tasks");
    expect(model.tables.Tasks.ids).toHaveLength(2);

    const task1Id = model.initIds.Tasks.task1;
    const aliceId = model.initIds.People.alice;
    const proj1Id = model.initIds.Projects.proj1;

    expect(model.tables.Tasks.entities[task1Id].d.assignedTo).toEqual({
      $table: "People",
      id: aliceId,
    });
    expect(model.tables.Tasks.entities[task1Id].d.project).toEqual({
      $table: "Projects",
      id: proj1Id,
    });
  });

  it("should allow chaining .addTables multiple times", () => {
    const model = Tables()
      .addTables({ A: { val: Text } })
      .addTables((Ref) => ({ B: { refA: Ref("A") } }))
      .addTables((Ref) => ({ C: { refB: Ref("B") } }))
      .populate(({ A, B }) => ({
        A: { a1: { val: "a" } },
        B: { b1: { refA: A("a1") } },
        C: { c1: { refB: B("b1") } },
      }))
      .done();

    expect(model.tables).toHaveProperty("A");
    expect(model.tables).toHaveProperty("B");
    expect(model.tables).toHaveProperty("C");

    const b1Id = model.initIds.B.b1;
    const c1Id = model.initIds.C.c1;
    expect(model.tables.C.entities[c1Id].d.refB).toEqual({
      $table: "B",
      id: b1Id,
    });
  });

  it("should populate tables correctly and resolve references", () => {
    const model = createTestModel().done();
    const aliceId = model.initIds.People.alice;
    const bobId = model.initIds.People.bob;
    const jamesId = model.initIds.People.james;
    const proj1Id = model.initIds.Projects.proj1;
    const task1Id = model.initIds.Tasks.task1;

    // Check People data and references
    expect(model.tables.People.entities[aliceId].d.name).toBe("Alice");
    expect(model.tables.People.entities[aliceId].d.favouriteCoWorker).toEqual({
      $table: "People",
      id: bobId,
    });
    expect(model.tables.People.entities[bobId].d.favouriteCoWorker).toBeNull();
    expect(model.tables.People.entities[jamesId].d.favouriteCoWorker).toEqual({
      $table: "People",
      id: aliceId,
    });

    // Check Projects data
    expect(model.tables.Projects.entities[proj1Id].d.title).toBe(
      "Website Redesign"
    );

    // Check Tasks data and references
    expect(model.tables.Tasks.entities[task1Id].d.title).toBe(
      "Design Homepage"
    );
    expect(model.tables.Tasks.entities[task1Id].d.assignedTo).toEqual({
      $table: "People",
      id: aliceId,
    });
    expect(model.tables.Tasks.entities[task1Id].d.project).toEqual({
      $table: "Projects",
      id: proj1Id,
    });
  });

  it("should return the final model structure via .done()", () => {
    const model = createTestModel().done();
    expect(model).toHaveProperty("tables");
    expect(model).toHaveProperty("initIds");
    expect(model).toHaveProperty("create");
    expect(model).toHaveProperty("select");
    expect(model).toHaveProperty("commit");
    expect(model).toHaveProperty("deepSelect");
  });

  it("should create empty tables if not populated", () => {
    const model = Tables()
      .addTables({ EmptyTable: { field: Text } })
      .populate(() => ({})) // Ne peuple pas EmptyTable
      .done();

    expect(model.tables).toHaveProperty("EmptyTable");
    expect(model.tables.EmptyTable.entities).toEqual({});
    expect(model.tables.EmptyTable.ids).toEqual([]);
  });
});

describe("TableOptions Configuration", () => {
  // Mock de la génération d'ID pour la prédictibilité
  let idCounter = 0;
  const predictableId = (key: string) => `fixed-${key}-${idCounter++}`;
  const predictableLabel = (key: string) => `label-${key}`;

  beforeEach(() => {
    idCounter = 0; // Réinitialiser le compteur avant chaque test
  });

  it("should use default id (random) and label (key) if no options provided", () => {
    // Pas facile de tester le caractère aléatoire, on vérifie juste la structure
    const model = createTestModel().done();
    const aliceEntry = model.tables.People.entities[model.initIds.People.alice];
    expect(aliceEntry.id).toBeTypeOf("string");
    expect(aliceEntry.id).not.toMatch(/^fixed-/); // Ne devrait pas être notre ID fixe
    expect(aliceEntry.label).toBe("alice"); // Le label par défaut est la clé
  });

  it("should use custom id generator from TableOptions", () => {
    const model = createTestModel({ id: predictableId }).done();
    const aliceEntry = model.tables.People.entities[model.initIds.People.alice];
    // L'ordre de processing interne détermine l'ID exact, on vérifie le format
    expect(aliceEntry.id).toMatch(/^fixed-alice-\d+$/);
  });

  it("should use custom label generator from TableOptions", () => {
    const model = createTestModel({ label: predictableLabel }).done();
    const aliceEntry = model.tables.People.entities[model.initIds.People.alice];
    expect(aliceEntry.label).toBe("label-alice");
  });

  it("should use custom id and label generators together", () => {
    const model = createTestModel({
      id: predictableId,
      label: predictableLabel,
    }).done();
    const aliceEntry = model.tables.People.entities[model.initIds.People.alice];
    expect(aliceEntry.id).toMatch(/^fixed-alice-\d+$/);
    expect(aliceEntry.label).toBe("label-alice");
  });
});

describe("initIds", () => {
  it("should correctly map populate keys to generated entry IDs", () => {
    const model = createTestModel().done();

    // Vérifie que les clés existent
    expect(model.initIds).toHaveProperty("People");
    expect(model.initIds).toHaveProperty("Projects");
    expect(model.initIds).toHaveProperty("Tasks");

    // Vérifie que les clés de populate correspondent aux IDs dans les tables
    expect(model.tables.People.entities[model.initIds.People.alice].label).toBe(
      "alice"
    );
    expect(model.tables.People.entities[model.initIds.People.bob].label).toBe(
      "bob"
    );
    expect(
      model.tables.Projects.entities[model.initIds.Projects.proj1].label
    ).toBe("proj1");
    expect(model.tables.Tasks.entities[model.initIds.Tasks.task1].label).toBe(
      "task1"
    );

    // Vérifie que les IDs sont bien des strings
    expect(typeof model.initIds.People.alice).toBe("string");
  });
});

describe("create", () => {
  let model: ReturnType<ReturnType<typeof createTestModel>["done"]>;

  beforeEach(() => {
    model = createTestModel().done();
  });

  it("should create a new entry with specified data and references using initIds", () => {
    const newTaskId = "task3";
    const newTask = model.create.Tasks(
      ({ People, Projects }) => ({
        title: "Review PR",
        assignedTo: People(model.initIds.People.james), // Référence via initIds
        project: Projects(model.initIds.Projects.proj1),
      }),
      { id: newTaskId, label: "reviewTask" }
    );

    expect(newTask).toEqual({
      id: newTaskId,
      label: "reviewTask",
      d: {
        title: "Review PR",
        assignedTo: { $table: "People", id: model.initIds.People.james },
        project: { $table: "Projects", id: model.initIds.Projects.proj1 },
      },
    });
  });

  it("should create a new entry with references using hardcoded (but valid) existing IDs", () => {
    const aliceId = model.initIds.People.alice;
    const proj2Id = model.initIds.Projects.proj2; // Supposons que proj2 existe
    const newTaskId = "task4";

    const newTask = model.create.Tasks(
      ({ People, Projects }) => ({
        title: "Client Meeting",
        assignedTo: People(aliceId), // Référence via ID direct
        project: Projects(proj2Id),
      }),
      { id: newTaskId } // Label par défaut
    );

    expect(newTask).toEqual({
      id: newTaskId,
      label: `Tasks_${newTaskId}`, // Label par défaut
      d: {
        title: "Client Meeting",
        assignedTo: { $table: "People", id: aliceId },
        project: { $table: "Projects", id: proj2Id },
      },
    });
  });

  it("should create an entry with a generated ID and default label if metadata is omitted", () => {
    const newTask = model.create.Projects(({}) => ({
      // Pas besoin de Ref ici
      title: "New Initiative",
      description: "Details about the initiative",
    }));

    expect(newTask.id).toBeTypeOf("string");
    expect(newTask.label).toBe(`Projects_${newTask.id}`);
    expect(newTask.d).toEqual({
      title: "New Initiative",
      description: "Details about the initiative",
    });
  });

  it("should create an entry with SelfRef", () => {
    const charlieId = "charlie";
    const bobId = model.initIds.People.bob;
    const newPerson = model.create.People(
      ({ People }) => ({
        name: "Charlie",
        age: 40,
        favouriteCoWorker: People(bobId), // Référence à Bob
      }),
      { id: charlieId }
    );

    expect(newPerson).toEqual({
      id: charlieId,
      label: `People_${charlieId}`,
      d: {
        name: "Charlie",
        age: 40,
        favouriteCoWorker: { $table: "People", id: bobId },
      },
    });
  });
});

describe("select", () => {
  let model: ReturnType<ReturnType<typeof createTestModel>["done"]>;
  let aliceId: string;
  let bobId: string;
  let jamesId: string;
  let proj1Id: string;
  let task1Id: string;
  let task2Id: string;

  beforeEach(() => {
    model = createTestModel().done();
    aliceId = model.initIds.People.alice;
    bobId = model.initIds.People.bob;
    jamesId = model.initIds.People.james;
    proj1Id = model.initIds.Projects.proj1;
    task1Id = model.initIds.Tasks.task1;
    task2Id = model.initIds.Tasks.task2;
  });

  it("select.byId should return the entry or undefined", () => {
    const aliceEntry = model.select.People.byId(model.tables, aliceId);
    expect(aliceEntry).toBeDefined();
    expect(aliceEntry?.id).toBe(aliceId);
    expect(aliceEntry?.d.name).toBe("Alice");

    const nonExistent = model.select.People.byId(
      model.tables,
      "non-existent-id"
    );
    expect(nonExistent).toBeUndefined();
  });

  it("select.byIdExn should return the entry or throw", () => {
    const bobEntry = model.select.People.byIdExn(model.tables, bobId);
    expect(bobEntry).toBeDefined();
    expect(bobEntry.id).toBe(bobId);
    expect(bobEntry.d.name).toBe("Bob");

    expect(() =>
      model.select.People.byIdExn(model.tables, "non-existent-id")
    ).toThrow(
      /\[relatix\] Entry with ID "non-existent-id" not found in table "People"\./
    ); // Ajuster le message d'erreur si nécessaire
  });

  it("select.entities should return the entities dictionary", () => {
    const peopleEntities = model.select.People.entities(model.tables);
    expect(Object.keys(peopleEntities)).toHaveLength(3);
    expect(peopleEntities[aliceId]).toBeDefined();
    expect(peopleEntities[bobId]).toBeDefined();
    expect(peopleEntities[jamesId]).toBeDefined();
    expect(peopleEntities[aliceId].d.name).toBe("Alice");
  });

  it("select.all should return an array of all entries", () => {
    const allPeople = model.select.People.all(model.tables);
    expect(allPeople).toHaveLength(3);
    expect(allPeople.map((p) => p.d.name)).toEqual(
      expect.arrayContaining(["Alice", "Bob", "James"])
    );
  });

  it("select.total should return the total number of entries", () => {
    const totalPeople = model.select.People.total(model.tables);
    expect(totalPeople).toBe(3);
    const totalTasks = model.select.Tasks.total(model.tables);
    expect(totalTasks).toBe(2);
    const totalProjects = model.select.Projects.total(model.tables);
    expect(totalProjects).toBe(2);
  });

  it("select.ids should return an array of all entry IDs", () => {
    const peopleIds = model.select.People.ids(model.tables);
    expect(peopleIds).toHaveLength(3);
    expect(peopleIds).toEqual(
      expect.arrayContaining([aliceId, bobId, jamesId])
    );
  });

  // TODO: Tester la mémoïsation peut être complexe.
  // On pourrait utiliser vi.spyOn sur une fonction interne si exposée,
  // ou vérifier que les objets retournés sont identiques (===) après des appels répétés sans modification.
  it("selectors should be memoized (basic check)", () => {
    const entities1 = model.select.People.entities(model.tables);
    const entities2 = model.select.People.entities(model.tables);
    expect(entities1).toBe(entities2); // Devrait retourner la même instance

    const all1 = model.select.People.all(model.tables);
    const all2 = model.select.People.all(model.tables);
    expect(all1).toBe(all2);

    // Modifier une autre table ne devrait pas invalider le cache de People
    const updatedTables = model.commit.Projects.removeOne(
      model.tables,
      proj1Id
    );
    const entities3 = model.select.People.entities(updatedTables);
    expect(entities3).toBe(entities1); // Toujours la même instance pour People

    // Modifier la table People devrait invalider le cache
    const updatedTables2 = model.commit.People.removeOne(
      updatedTables,
      aliceId
    );
    const entities4 = model.select.People.entities(updatedTables2);
    expect(entities4).not.toBe(entities1); // Devrait être une nouvelle instance
  });
});

describe("commit", () => {
  let initialModel: ReturnType<ReturnType<typeof createTestModel>["done"]>;
  let initialTables: typeof initialModel.tables;
  let aliceId: string;
  let bobId: string;
  let jamesId: string;
  let proj1Id: string;
  let proj2Id: string;
  let task1Id: string;
  let task2Id: string;

  beforeEach(() => {
    initialModel = createTestModel().done();
    initialTables = JSON.parse(JSON.stringify(initialModel.tables)); // Deep copy pour vérifier l'immutabilité
    aliceId = initialModel.initIds.People.alice;
    bobId = initialModel.initIds.People.bob;
    jamesId = initialModel.initIds.People.james;
    proj1Id = initialModel.initIds.Projects.proj1;
    proj2Id = initialModel.initIds.Projects.proj2;
    task1Id = initialModel.initIds.Tasks.task1;
    task2Id = initialModel.initIds.Tasks.task2;
  });

  const expectImmutability = (
    newTables: typeof initialTables,
    originalTables: typeof initialTables
  ) => {
    expect(newTables).not.toBe(originalTables); // Le conteneur principal doit être différent
    // Vérifier qu'au moins une sous-table modifiée est différente
    // (les autres peuvent être identiques si non modifiées)
    // expect(newTables.People).not.toBe(originalTables.People); // Exemple si People a été modifié
  };

  it("commit.addOne should add a new entry", () => {
    const davidEntry = initialModel.create.People(
      ({}) => ({ name: "David", age: 28, favouriteCoWorker: null }),
      { id: "david" }
    );
    const newTables = initialModel.commit.People.addOne(
      initialModel.tables,
      davidEntry
    );

    expectImmutability(newTables, initialModel.tables);
    expect(initialModel.select.People.total(initialModel.tables)).toBe(3); // Original inchangé
    expect(
      initialModel.select.People.byId(initialModel.tables, "david")
    ).toBeUndefined(); // Original inchangé

    expect(initialModel.select.People.total(newTables)).toBe(4);
    expect(initialModel.select.People.byId(newTables, "david")).toEqual(
      davidEntry
    );
    expect(newTables.People.ids).toContain("david");
  });

  it("commit.addOne should not add an entry if ID already exists", () => {
    const existingAlice = initialModel.tables.People.entities[aliceId];
    const newTables = initialModel.commit.People.addOne(initialModel.tables, {
      ...existingAlice,
      d: { ...existingAlice.d, age: 99 },
    }); // Tente d'ajouter avec l'ID d'Alice

    expect(newTables).toBe(initialModel.tables); // Devrait retourner la même instance car rien n'a été ajouté
    expect(initialModel.select.People.total(newTables)).toBe(3);
    expect(initialModel.select.People.byId(newTables, aliceId)?.d.age).toBe(25); // L'âge original n'a pas changé
  });

  it("commit.addMany should add multiple new entries", () => {
    const project3 = initialModel.create.Projects(
      () => ({ title: "Proj 3", description: "Desc 3" }),
      { id: "proj3" }
    );
    const project4 = initialModel.create.Projects(
      () => ({ title: "Proj 4", description: "Desc 4" }),
      { id: "proj4" }
    );
    const newTables = initialModel.commit.Projects.addMany(
      initialModel.tables,
      [project3, project4]
    );

    expectImmutability(newTables, initialModel.tables);
    expect(initialModel.select.Projects.total(initialModel.tables)).toBe(2); // Original inchangé

    expect(initialModel.select.Projects.total(newTables)).toBe(4);
    expect(initialModel.select.Projects.byId(newTables, "proj3")).toEqual(
      project3
    );
    expect(initialModel.select.Projects.byId(newTables, "proj4")).toEqual(
      project4
    );
    expect(newTables.Projects.ids).toEqual(
      expect.arrayContaining(["proj3", "proj4"])
    );
  });

  it("commit.addMany should only add entries with new IDs", () => {
    const project3 = initialModel.create.Projects(
      () => ({ title: "Proj 3", description: "Desc 3" }),
      { id: "proj3" }
    );
    const existingProj1 = initialModel.tables.Projects.entities[proj1Id];
    const newTables = initialModel.commit.Projects.addMany(
      initialModel.tables,
      [
        project3,
        {
          ...existingProj1,
          d: { title: "Updated Title", description: "..." },
        },
      ]
    ); // Tente d'ajouter proj3 (nouveau) et proj1 (existant)

    expectImmutability(newTables, initialModel.tables);
    expect(initialModel.select.Projects.total(newTables)).toBe(3); // Seul proj3 a été ajouté
    expect(initialModel.select.Projects.byId(newTables, "proj3")).toBeDefined();
    expect(initialModel.select.Projects.byId(newTables, proj1Id)?.d.title).toBe(
      "Website Redesign"
    ); // L'entrée existante n'est pas modifiée par addMany
  });

  it("commit.upsertOne should add a new entry if ID does not exist", () => {
    const davidEntry = initialModel.create.People(
      ({}) => ({ name: "David", age: 28, favouriteCoWorker: null }),
      { id: "david" }
    );
    const newTables = initialModel.commit.People.upsertOne(
      initialModel.tables,
      davidEntry
    );

    expectImmutability(newTables, initialModel.tables);
    expect(initialModel.select.People.total(newTables)).toBe(4);
    expect(initialModel.select.People.byId(newTables, "david")).toEqual(
      davidEntry
    );
  });

  it("commit.upsertOne should add a new entry if ID does not exist (using full entry)", () => {
    // David doit être une entrée complète
    const davidEntry = initialModel.create.People(
      ({}) => ({
        // Pas besoin de Ref ici si pas de référence interne
        name: "David",
        age: 28,
        favouriteCoWorker: null,
      }),
      { id: "david", label: "david_label" } // Fournir un label ici aussi
    );
    const newTables = initialModel.commit.People.upsertOne(
      initialModel.tables,
      davidEntry
    );

    expectImmutability(newTables, initialModel.tables);
    expect(initialModel.select.People.total(newTables)).toBe(4);
    // Vérifier que l'entrée ajoutée est exactement celle fournie
    expect(initialModel.select.People.byId(newTables, "david")).toEqual(
      davidEntry
    );
  });

  it("commit.upsertOne should update only differing leaf fields of an existing entry when given a full entry", () => {
    const originalAlice = initialModel.select.People.byIdExn(
      initialModel.tables,
      aliceId
    );

    // Créer une version complète d'Alice avec SEULEMENT l'âge et le label modifiés
    const updatePayload: typeof originalAlice = {
      id: aliceId,
      label: "alice_updated_label", // Nouveau label
      d: {
        name: "Alice", // Nom INCHANGÉ (doit être fourni)
        age: 27, // Nouvel âge
        favouriteCoWorker: { $table: "People", id: bobId }, // Référence INCHANGÉE (doit être fournie)
      },
    };

    const newTables = initialModel.commit.People.upsertOne(
      initialModel.tables,
      updatePayload
    );

    expectImmutability(newTables, initialModel.tables);
    expect(initialModel.select.People.total(newTables)).toBe(3); // Taille inchangée

    const updatedAlice = initialModel.select.People.byIdExn(newTables, aliceId);

    // Vérifier les champs mis à jour
    expect(updatedAlice.label).toBe("alice_updated_label");
    expect(updatedAlice.d.age).toBe(27);

    // Vérifier les champs INCHANGÉS (même s'ils étaient dans le payload)
    expect(updatedAlice.d.name).toBe("Alice");
    expect(updatedAlice.d.favouriteCoWorker).toEqual({
      $table: "People",
      id: bobId,
    });

    // Idéalement, si l'implémentation est correcte, les sous-objets non modifiés
    // pourraient même conserver la même référence mémoire (optimisation possible par l'implémentation)
    // expect(updatedAlice.d.favouriteCoWorker).toBe(originalAlice.d.favouriteCoWorker); // Ceci est un test plus strict dépendant de l'implémentation
  });

  it("commit.upsertOne should not change an existing entry if the provided full entry has no differing leaf fields", () => {
    const originalAlice = initialModel.select.People.byIdExn(
      initialModel.tables,
      aliceId
    );

    // Fournir une copie exacte de l'entrée originale
    const nonUpdatePayload: typeof originalAlice = JSON.parse(
      JSON.stringify(originalAlice)
    ); // Copie profonde

    const newTables = initialModel.commit.People.upsertOne(
      initialModel.tables,
      nonUpdatePayload
    );

    // L'implémentation pourrait retourner la même instance si rien n'a changé
    // Ou une nouvelle instance mais avec un contenu identique
    // Testons le contenu :
    expect(initialModel.select.People.byIdExn(newTables, aliceId)).toEqual(
      originalAlice
    );
    // Optionnel : vérifier si l'instance est la même (si l'implémentation optimise)
    // expect(newTables).toBe(initialModel.tables); OU expect(newTables.People).toBe(initialModel.tables.People);
  });

  it("commit.upsertMany should add new and update existing entries based on differing leaves (using full entries)", () => {
    // 1. Nouvelle entrée (complète)
    const davidEntry = initialModel.create.People(
      ({}) => ({ name: "David", age: 28, favouriteCoWorker: null }),
      { id: "david", label: "david_label" }
    );

    // 2. Mise à jour pour Bob (entrée complète avec seulement age/label différents)
    const originalBob = initialModel.select.People.byIdExn(
      initialModel.tables,
      bobId
    );
    const updateBobPayload: typeof originalBob = {
      id: bobId,
      label: "bob_updated_label", // Nouveau label
      d: {
        name: "Bob", // Nom INCHANGÉ
        age: 32, // Nouvel âge
        favouriteCoWorker: null, // Référence INCHANGÉE (null)
      },
    };

    // 3. Entrée pour James (complète mais identique à l'originale)
    const originalJames = initialModel.select.People.byIdExn(
      initialModel.tables,
      jamesId
    );
    const nonUpdateJamesPayload: typeof originalJames = JSON.parse(
      JSON.stringify(originalJames)
    );

    const payload = [davidEntry, updateBobPayload, nonUpdateJamesPayload];
    const newTables = initialModel.commit.People.upsertMany(
      initialModel.tables,
      payload
    );

    expectImmutability(newTables, initialModel.tables);
    expect(initialModel.select.People.total(newTables)).toBe(4); // Ajout de David

    // Vérifier David (nouvelle entrée)
    expect(initialModel.select.People.byIdExn(newTables, "david")).toEqual(
      davidEntry
    );

    // Vérifier Bob (mis à jour)
    const updatedBob = initialModel.select.People.byIdExn(newTables, bobId);
    expect(updatedBob.label).toBe("bob_updated_label");
    expect(updatedBob.d.age).toBe(32);
    expect(updatedBob.d.name).toBe("Bob"); // Inchangé
    expect(updatedBob.d.favouriteCoWorker).toBeNull(); // Inchangé

    // Vérifier James (inchangé)
    const updatedJames = initialModel.select.People.byIdExn(newTables, jamesId);
    expect(updatedJames).toEqual(originalJames);
    // Optionnel : vérifier si l'instance est la même (si l'implémentation optimise)
    // expect(updatedJames).toBe(originalJames);

    // Vérifier Alice (non incluse dans le payload, donc inchangée)
    expect(initialModel.select.People.byIdExn(newTables, aliceId)).toEqual(
      initialModel.tables.People.entities[aliceId]
    );
  });
  it("commit.setOne should add a new entry if ID does not exist", () => {
    const davidEntry = initialModel.create.People(
      ({}) => ({ name: "David", age: 28, favouriteCoWorker: null }),
      { id: "david" }
    );
    const newTables = initialModel.commit.People.setOne(
      initialModel.tables,
      davidEntry
    );

    expectImmutability(newTables, initialModel.tables);
    expect(initialModel.select.People.total(newTables)).toBe(4);
    expect(initialModel.select.People.byId(newTables, "david")).toEqual(
      davidEntry
    );
  });

  it("commit.setOne should replace an existing entry completely", () => {
    const replacementAlice: Entry<
      (typeof initialModel.tables.People.entities)[typeof aliceId]["d"]
    > = {
      id: aliceId,
      label: "new_alice_label", // Le label est aussi remplacé
      d: { name: "Alice V2", age: 100, favouriteCoWorker: null }, // Données complètement nouvelles
    };
    const newTables = initialModel.commit.People.setOne(
      initialModel.tables,
      replacementAlice
    );

    expectImmutability(newTables, initialModel.tables);
    expect(initialModel.select.People.total(newTables)).toBe(3); // Taille inchangée
    const updatedAlice = initialModel.select.People.byIdExn(newTables, aliceId);
    expect(updatedAlice).toEqual(replacementAlice); // L'entrée entière est remplacée
  });

  it("commit.setMany should add new and replace existing entries", () => {
    const davidEntry = initialModel.create.People(
      ({}) => ({ name: "David", age: 28, favouriteCoWorker: null }),
      { id: "david" }
    );
    const replacementBob: Entry<
      (typeof initialModel.tables.People.entities)[typeof bobId]["d"]
    > = {
      id: bobId,
      label: "bob_v2",
      d: { name: "Robert", age: 50, favouriteCoWorker: null },
    };
    const payload = [davidEntry, replacementBob];
    const newTables = initialModel.commit.People.setMany(
      initialModel.tables,
      payload
    );

    expectImmutability(newTables, initialModel.tables);
    expect(initialModel.select.People.total(newTables)).toBe(4); // Ajout de David
    expect(initialModel.select.People.byIdExn(newTables, "david")).toEqual(
      davidEntry
    );
    expect(initialModel.select.People.byIdExn(newTables, bobId)).toEqual(
      replacementBob
    ); // Bob remplacé
    expect(initialModel.select.People.byIdExn(newTables, aliceId)).toEqual(
      initialModel.tables.People.entities[aliceId]
    ); // Alice inchangée
  });

  it("commit.setAll should replace all entries in the table", () => {
    const davidEntry = initialModel.create.People(
      ({}) => ({ name: "David", age: 28, favouriteCoWorker: null }),
      { id: "david" }
    );
    const charlieEntry = initialModel.create.People(
      ({}) => ({ name: "Charlie", age: 35, favouriteCoWorker: null }),
      { id: "charlie" }
    );
    const newEntries = [davidEntry, charlieEntry];
    const newTables = initialModel.commit.People.setAll(
      initialModel.tables,
      newEntries
    );

    expectImmutability(newTables, initialModel.tables);
    expect(initialModel.select.People.total(initialModel.tables)).toBe(3); // Original inchangé

    expect(initialModel.select.People.total(newTables)).toBe(2); // Nouvelle taille
    expect(initialModel.select.People.byId(newTables, aliceId)).toBeUndefined(); // Alice n'existe plus
    expect(initialModel.select.People.byId(newTables, "david")).toEqual(
      davidEntry
    );
    expect(initialModel.select.People.byId(newTables, "charlie")).toEqual(
      charlieEntry
    );
    expect(newTables.People.ids).toEqual(["david", "charlie"]); // Nouveaux IDs
  });

  it("commit.updateOne should update (deep merge) specified fields of an existing entry", () => {
    const changes = { d: { age: 26 }, label: "alice_updated_label" }; // Met à jour age dans 'd' et le label
    const newTables = initialModel.commit.People.updateOne(
      initialModel.tables,
      { id: aliceId, changes }
    );

    expectImmutability(newTables, initialModel.tables);
    expect(initialModel.select.People.total(newTables)).toBe(3);
    const updatedAlice = initialModel.select.People.byIdExn(newTables, aliceId);
    expect(updatedAlice.d.name).toBe("Alice"); // Nom inchangé
    expect(updatedAlice.d.age).toBe(26); // Âge mis à jour
    expect(updatedAlice.label).toBe("alice_updated_label"); // Label mis à jour
    expect(updatedAlice.d.favouriteCoWorker).toEqual({
      $table: "People",
      id: bobId,
    }); // Référence inchangée
  });

  it("commit.updateOne should do nothing if ID does not exist", () => {
    const changes = { d: { age: 99 } };
    const newTables = initialModel.commit.People.updateOne(
      initialModel.tables,
      { id: "non-existent", changes }
    );
    expect(newTables).toBe(initialModel.tables); // Rien n'a changé, même instance retournée
  });

  it("commit.updateMany should update multiple entries", () => {
    const updates = [
      { id: aliceId, changes: { d: { age: 27 } } },
      { id: bobId, changes: { label: "bob_updated" } },
      { id: "non-existent", changes: { d: { age: 1 } } }, // Devrait être ignoré
    ];
    const newTables = initialModel.commit.People.updateMany(
      initialModel.tables,
      updates
    );

    expectImmutability(newTables, initialModel.tables);
    expect(initialModel.select.People.total(newTables)).toBe(3);
    expect(initialModel.select.People.byIdExn(newTables, aliceId).d.age).toBe(
      27
    );
    expect(initialModel.select.People.byIdExn(newTables, bobId).label).toBe(
      "bob_updated"
    );
    expect(initialModel.select.People.byIdExn(newTables, bobId).d.age).toBe(30); // L'âge de Bob n'a pas changé
  });

  it("commit.removeOne should remove the specified entry", () => {
    const newTables = initialModel.commit.People.removeOne(
      initialModel.tables,
      aliceId
    );

    expectImmutability(newTables, initialModel.tables);
    expect(initialModel.select.People.total(initialModel.tables)).toBe(3); // Original inchangé
    expect(
      initialModel.select.People.byId(initialModel.tables, aliceId)
    ).toBeDefined(); // Original inchangé

    expect(initialModel.select.People.total(newTables)).toBe(2);
    expect(initialModel.select.People.byId(newTables, aliceId)).toBeUndefined();
    expect(newTables.People.ids).not.toContain(aliceId);
    expect(newTables.People.ids).toEqual(
      expect.arrayContaining([bobId, jamesId])
    );
  });

  it("commit.removeOne should do nothing if ID does not exist", () => {
    const newTables = initialModel.commit.People.removeOne(
      initialModel.tables,
      "non-existent"
    );
    expect(newTables).toBe(initialModel.tables); // Instance identique
    expect(initialModel.select.People.total(newTables)).toBe(3);
  });

  it("commit.removeMany should remove multiple specified entries", () => {
    const idsToRemove = [aliceId, jamesId, "non-existent"]; // non-existent est ignoré
    const newTables = initialModel.commit.People.removeMany(
      initialModel.tables,
      idsToRemove
    );

    expectImmutability(newTables, initialModel.tables);
    expect(initialModel.select.People.total(newTables)).toBe(1);
    expect(initialModel.select.People.byId(newTables, aliceId)).toBeUndefined();
    expect(initialModel.select.People.byId(newTables, jamesId)).toBeUndefined();
    expect(initialModel.select.People.byId(newTables, bobId)).toBeDefined(); // Bob reste
    expect(newTables.People.ids).toEqual([bobId]);
  });

  it("commit.removeAll should remove all entries from the table", () => {
    const newTables = initialModel.commit.People.removeAll(initialModel.tables);

    expectImmutability(newTables, initialModel.tables);
    expect(initialModel.select.People.total(initialModel.tables)).toBe(3); // Original inchangé

    expect(initialModel.select.People.total(newTables)).toBe(0);
    expect(initialModel.select.People.all(newTables)).toEqual([]);
    expect(newTables.People.entities).toEqual({});
    expect(newTables.People.ids).toEqual([]);
  });
});

describe("deepSelect", () => {
  let model: ReturnType<ReturnType<typeof createTestModel>["done"]>;
  let aliceId: string;
  let bobId: string;
  let jamesId: string;
  let proj1Id: string;
  let task1Id: string;
  let task2Id: string;

  beforeEach(() => {
    model = createTestModel().done();
    aliceId = model.initIds.People.alice;
    bobId = model.initIds.People.bob;
    jamesId = model.initIds.People.james;
    proj1Id = model.initIds.Projects.proj1;
    task1Id = model.initIds.Tasks.task1;
    task2Id = model.initIds.Tasks.task2;
  });

  it("deepSelect.byId should return the entry with resolved references", () => {
    const deepTask1 = model.deepSelect.Tasks.byId(model.tables, task1Id);

    expect(deepTask1).toBeDefined();
    expect(deepTask1?.title).toBe("Design Homepage");

    // Check resolved assignedTo (People) - SelfRef should be a DataRef
    expect(deepTask1?.assignedTo).toEqual({
      name: "Alice",
      age: 25,
      // favouriteCoWorker est une SelfRef, donc non résolue profondément par défaut
      favouriteCoWorker: { $table: "People", id: bobId },
    });

    // Check resolved project (Projects)
    expect(deepTask1?.project).toEqual({
      title: "Website Redesign",
      description: "Revamp company site",
    });

    const nonExistent = model.deepSelect.Tasks.byId(
      model.tables,
      "non-existent"
    );
    expect(nonExistent).toBeUndefined();
  });

  it("deepSelect.byIdExn should return the resolved entry or throw", () => {
    const deepTask2 = model.deepSelect.Tasks.byIdExn(model.tables, task2Id);

    expect(deepTask2).toBeDefined();
    expect(deepTask2.title).toBe("Implement Login");
    expect(deepTask2.assignedTo).toEqual({
      name: "Bob",
      age: 30,
      favouriteCoWorker: null, // favouriteCoWorker de Bob est null
    });
    expect(deepTask2.project).toEqual({
      title: "Website Redesign",
      description: "Revamp company site",
    });

    expect(() =>
      model.deepSelect.Tasks.byIdExn(model.tables, "non-existent")
    ).toThrow(
      /\[relatix\] Entry with ID "non-existent" not found in table "Tasks"\./
    ); // Ajuster le message d'erreur si nécessaire
  });

  it("deepSelect should handle SelfRef by not infinitely recursing", () => {
    // James -> Alice -> Bob -> null
    const deepJames = model.deepSelect.People.byIdExn(model.tables, jamesId);

    expect(deepJames).toBeDefined();
    expect(deepJames.name).toBe("James");
    expect(deepJames.age).toBe(26);
    // favouriteCoWorker (Alice) est une SelfRef, donc elle n'est pas résolue par défaut
    expect(deepJames.favouriteCoWorker).toEqual({
      $table: "People",
      id: aliceId,
    });

    // Testons Alice aussi
    const deepAlice = model.deepSelect.People.byIdExn(model.tables, aliceId);
    expect(deepAlice.name).toBe("Alice");
    expect(deepAlice.age).toBe(25);
    // favouriteCoWorker (Bob) est une SelfRef, donc elle n'est pas résolue par défaut
    expect(deepAlice.favouriteCoWorker).toEqual({
      $table: "People",
      id: bobId,
    });
  });

  it("deepSelect.all should return all entries resolved", () => {
    const allDeepTasks = model.deepSelect.Tasks.all(model.tables);
    expect(allDeepTasks).toHaveLength(2);

    const deepTask1 = allDeepTasks.find((t) => t?.title === "Design Homepage"); // Utiliser une prop unique
    const deepTask2 = allDeepTasks.find((t) => t?.title === "Implement Login");

    expect(deepTask1?.assignedTo.name).toBe("Alice");
    expect(deepTask1?.project.title).toBe("Website Redesign");
    expect(deepTask2?.assignedTo.name).toBe("Bob");
    expect(deepTask2?.project.title).toBe("Website Redesign");
  });

  it("deepSelect.entities should return a dictionary of resolved entries", () => {
    const deepEntities = model.deepSelect.Tasks.entities(model.tables);
    expect(Object.keys(deepEntities)).toHaveLength(2);
    expect(deepEntities[task1Id]).toBeDefined();
    expect(deepEntities[task2Id]).toBeDefined();

    expect(deepEntities[task1Id]?.assignedTo.name).toBe("Alice");
    expect(deepEntities[task1Id]?.project.title).toBe("Website Redesign");
  });

  it("deepSelect should respect the depth parameter", () => {
    // Modèle plus profond: C -> B -> A
    const deepModel = Tables()
      .addTables({ A: { value: Number } })
      .addTables((Ref) => ({ B: { refA: Ref("A") } }))
      .addTables((Ref) => ({ C: { refB: Ref("B") } }))
      .populate(({ A, B }) => ({
        A: { a1: { value: 10 } },
        B: { b1: { refA: A("a1") } },
        C: { c1: { refB: B("b1") } },
      }))
      .done();

    const c1Id = deepModel.initIds.C.c1;
    const b1Id = deepModel.initIds.B.b1;
    const a1Id = deepModel.initIds.A.a1;

    // Depth 0: Pas de résolution
    const deepC_d0 = deepModel.deepSelect.C.byIdExn(deepModel.tables, c1Id, 0);
    expect(deepC_d0.refB).toEqual({ $table: "B", id: b1Id });

    // Depth 1: Résout C -> B, mais pas B -> A
    const deepC_d1 = deepModel.deepSelect.C.byIdExn(deepModel.tables, c1Id, 1);

    expect(deepC_d1.refB).toBeTypeOf("object");
    expect(deepC_d1.refB.refA).toEqual({ $table: "A", id: a1Id }); // Non résolu

    // Depth 2 (ou plus): Résout C -> B -> A
    const deepC_d2 = deepModel.deepSelect.C.byIdExn(deepModel.tables, c1Id, 2);
    expect(deepC_d2.refB).toBeTypeOf("object");
    expect(deepC_d2.refB.refA).toBeTypeOf("object");
    expect(deepC_d2.refB.refA.value).toBe(10); // Entièrement résolu

    // Profondeur par défaut (devrait être suffisant)
    const deepC_default = deepModel.deepSelect.C.byIdExn(
      deepModel.tables,
      c1Id
    );
    expect(deepC_default.refB.refA.value).toBe(10);
  });

  // Test spécifique pour le cas géométrique
  it("deepSelect should work with the CompositeShapes example", () => {
    const geometryModel = Tables()
      .addTables({
        Points: { x: Number, y: Number },
      })
      .addTables((Ref) => ({
        Lines: { pointA: Ref("Points"), pointB: Ref("Points") },
      }))
      .addTables((Ref) => ({
        CompositeShapes: {
          name: Text,
          outline: Ref("Lines"),
          subShape: SelfRef as typeof SelfRef | null,
        },
      }))
      .populate(({ Points, Lines, CompositeShapes }) => ({
        Points: {
          p1: { x: 0, y: 0 },
          p2: { x: 10, y: 0 },
          p3: { x: 10, y: 10 },
          p4: { x: 0, y: 10 },
        },
        Lines: {
          l1: { pointA: Points("p1"), pointB: Points("p2") },
          l2: { pointA: Points("p2"), pointB: Points("p3") },
        },
        CompositeShapes: {
          cs1: { name: "Square", outline: Lines("l1"), subShape: null },
          cs2: {
            name: "Complex Square",
            outline: Lines("l2"),
            subShape: CompositeShapes("cs1"),
          },
        },
      }))
      .done();

    const cs1Id = geometryModel.initIds.CompositeShapes.cs1;
    const cs2Id = geometryModel.initIds.CompositeShapes.cs2;

    const deepCS2 = geometryModel.deepSelect.CompositeShapes.byIdExn(
      geometryModel.tables,
      cs2Id
    );

    // Vérification de la structure attendue (AVEC subShape NON résolu)
    expect(deepCS2).toEqual({
      name: "Complex Square",
      outline: {
        // outline est résolu (Lines -> Points)
        pointA: { x: 10, y: 0 },
        pointB: { x: 10, y: 10 },
      },
      // subShape est une SelfRef, donc elle doit rester une DataRef
      subShape: {
        $table: "CompositeShapes",
        id: cs1Id, // L'ID doit correspondre à celui de cs1
      },
    });

    // Vous pouvez aussi ajouter un test pour vérifier cs1 directement
    const deepCS1 = geometryModel.deepSelect.CompositeShapes.byIdExn(
      geometryModel.tables,
      cs1Id
    );
    expect(deepCS1).toEqual({
      name: "Square",
      outline: {
        // outline de cs1 est résolu
        pointA: { x: 0, y: 0 },
        pointB: { x: 10, y: 0 },
      },
      subShape: null, // subShape de cs1 est null
    });

    const deepCS2_d1 = geometryModel.deepSelect.CompositeShapes.byIdExn(
      geometryModel.tables,
      cs2Id,
      1 // Depth = 1
    );

    const p2Id = geometryModel.initIds.Points.p2; // Assurez-vous que les IDs des points sont disponibles
    const p3Id = geometryModel.initIds.Points.p3;

    // Avec depth=1 depuis CS2, 'outline' (Line) est résolu, mais pas les 'Points' dedans.
    // 'subShape' (SelfRef) n'est pas résolu non plus.
    expect(deepCS2_d1.outline.pointA).toEqual({ $table: "Points", id: p2Id }); // Doit rester une DataRef
    expect(deepCS2_d1.outline.pointB).toEqual({ $table: "Points", id: p3Id }); // Doit rester une DataRef
    expect(deepCS2_d1.subShape).toEqual({
      $table: "CompositeShapes",
      id: cs1Id,
    }); // Doit rester une DataRef (SelfRef)

    // Vérification avec depth=2 (Doit résoudre les Points dans outline, mais pas subShape->outline)
    const deepCS2_d2 = geometryModel.deepSelect.CompositeShapes.byIdExn(
      geometryModel.tables,
      cs2Id,
      2 // Depth = 2
    );
    expect(deepCS2_d2.outline.pointA).toEqual({ x: 10, y: 0 }); // Résolu à depth 2
    expect(deepCS2_d2.outline.pointB).toEqual({ x: 10, y: 10 }); // Résolu à depth 2
    expect(deepCS2_d2.subShape).toEqual({
      $table: "CompositeShapes",
      id: cs1Id,
    }); // Toujours une DataRef (SelfRef)
  });
});
