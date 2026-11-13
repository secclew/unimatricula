const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bcrypt = require('bcrypt');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Conexão com o Banco de Dados SQLite
const db = new sqlite3.Database('./unimatricula.db', (err) => {
    if (err) {
        console.error("Erro ao abrir o banco de dados:", err.message);
    } else {
        console.log("Conectado ao banco de dados SQLite com segurança.");
        criarTabelasESeed();
    }
});

// Criar tabelas e usuários iniciais com Hash
function criarTabelasESeed() {
    db.serialize(async () => {
        
        // 1. Tabela de Alunos (Exclusiva para discentes)
        db.run(`CREATE TABLE IF NOT EXISTS alunos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            senha TEXT NOT NULL
        )`);

        // 2. Tabela de Professores
        db.run(`CREATE TABLE IF NOT EXISTS professores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            senha TEXT NOT NULL
        )`);

        // 3. Tabela de Administradores
        db.run(`CREATE TABLE IF NOT EXISTS admins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            senha TEXT NOT NULL
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS disciplinas (
            codigo TEXT PRIMARY KEY,
            nome TEXT NOT NULL,
            cargaHoraria INTEGER NOT NULL
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS turmas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            codigoDisciplina TEXT NOT NULL,
            idProfessor INTEGER NOT NULL,
            dia INTEGER NOT NULL,
            turno INTEGER NOT NULL,
            horario TEXT NOT NULL,
            vagasTotais INTEGER NOT NULL,
            vagasOcupadas INTEGER DEFAULT 0,
            FOREIGN KEY(codigoDisciplina) REFERENCES disciplinas(codigo),
            FOREIGN KEY(idProfessor) REFERENCES professores(id)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS matriculas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            alunoId INTEGER,
            turmaId INTEGER,
            FOREIGN KEY(alunoId) REFERENCES alunos(id),
            FOREIGN KEY(turmaId) REFERENCES turmas(id)
        )`);

        // Inserir usuários padrão se a tabela estiver vazia (Senha padrão criptografada: '123456')
        db.get("SELECT COUNT(*) as count FROM alunos", async (err, row) => {
            if (row.count === 0) {
                const senhaHash = await bcrypt.hash("123456", 10);
                
                // Inserir Aluno Padrão
                db.run(
                    `INSERT INTO alunos (nome, email, senha) VALUES 
                    (?, ?, ?), 
                    (?, ?, ?), 
                    (?, ?, ?), 
                    (?, ?, ?), 
                    (?, ?, ?)`,
                    [
                        "Carlos Silva", "carlos.silva@unimatricula.br", senhaHash,
                        "Mariana Oliveira", "mariana.oliveira@unimatricula.br", senhaHash,
                        "Lucas Santos", "lucas.santos@unimatricula.br", senhaHash,
                        "Beatriz Costa", "beatriz.costa@unimatricula.br", senhaHash,
                        "Gabriel Lima", "gabriel.lima@unimatricula.br", senhaHash
                    ]
);
                // Inserir admin padrão
                db.run("INSERT INTO admins (nome, email, senha) VALUES (?, ?, ?)", 
                    ["Coordenação Acadêmica", "admin@unimatricula.br", senhaHash,]);

                // Inserir professor padrão
                db.run("INSERT INTO professores (nome, email, senha) VALUES (?, ?, ?)", 
                    ["Ana Souza", "ana.souza@unimatricula.br", senhaHash]);
                    
                // Dados acadêmicos iniciais
                db.run("INSERT OR IGNORE INTO disciplinas VALUES ('INF101', 'Programação Web', 60)");
                db.run("INSERT OR IGNORE INTO disciplinas VALUES ('INF102', 'Estruturas de Dados', 80)");
                db.run("INSERT OR IGNORE INTO disciplinas VALUES ('MAT101', 'Matemática para Computação', 60)");
                db.run("INSERT OR IGNORE INTO disciplinas VALUES ('INF103', 'Programação II', 60)");
                db.run("INSERT OR IGNORE INTO disciplinas VALUES ('INF104', 'Análise de Dados', 60)");

                // Turma inicial vinculada ao professor ID 1 (Ana Souza)
                db.run("INSERT INTO turmas (codigoDisciplina, idProfessor, dia, turno, horario, vagasTotais, vagasOcupadas) VALUES ('INF101', 1, 2, 1, '19:00-20:40', 30, 1)");
                
                // Matrícula inicial do aluno 1 na turma 1
                db.run("INSERT INTO matriculas (alunoId, turmaId) VALUES (1, 1)");
                
                console.log("Banco de dados populado com dados acadêmicos e usuários padrão.");
            }
        });
    });
}

// --- ROTAS DE AUTENTICAÇÃO ---

// app.post('/api/auth/login', (req, res) => {
//     const { email, senha } = req.body;

//     db.get("SELECT * FROM usuarios WHERE email = ?", [email], async (err, usuario) => {
//         if (err || !usuario) {
//             return res.status(401).json({ erro: "E-mail ou senha inválidos." });
//         }

//         const senhaValida = await bcrypt.compare(senha, usuario.senha);
//         if (!senhaValida) {
//             return res.status(401).json({ erro: "E-mail ou senha inválidos." });
//         }

//         res.json({
//             id: usuario.id,
//             nome: usuario.nome,
//             email: usuario.email,
//             tipo: usuario.tipo
//         });
//     });
// });

app.post('/api/auth/login', (req, res) => {
    const { email, senha } = req.body;

    // Buscamos em cada tabela definindo explicitamente o "tipo" do usuário no retorno
    const query = `
        SELECT id, nome, email, senha, 'aluno' AS tipo FROM alunos WHERE email = ?
        UNION
        SELECT id, nome, email, senha, 'professor' AS tipo FROM professores WHERE email = ?
        UNION
        SELECT id, nome, email, senha, 'admin' AS tipo FROM admins WHERE email = ?
    `;

    db.get(query, [email, email, email], async (err, usuario) => {
        if (err || !usuario) {
            return res.status(401).json({ erro: "E-mail ou senha inválidos." });
        }

        const senhaValida = await bcrypt.compare(senha, usuario.senha);
        if (!senhaValida) {
            return res.status(401).json({ erro: "E-mail ou senha inválidos." });
        }

        // Retornamos o "tipo" para o front-end saber para qual painel redirecionar
        res.json({
            id: usuario.id,
            nome: usuario.nome,
            email: usuario.email,
            tipo: usuario.tipo // 'aluno', 'professor' ou 'admin'
        });
    });
});

// app.post('/api/auth/registrar', async (req, res) => {
//     const { nome, email, senha, tipo } = req.body;

//     try {
//         const senhaHash = await bcrypt.hash(senha, 10);
//         db.run("INSERT INTO usuarios (nome, email, senha, tipo) VALUES (?, ?, ?, ?)",
//             [nome, email, senhaHash, tipo || 'aluno'], function(err) {
//                 if (err) {
//                     return res.status(400).json({ erro: "Este e-mail já está cadastrado." });
//                 }
//                 res.json({ mensagem: "Usuário cadastrado com sucesso!", id: this.lastID });
//             });
//     } catch (e) {
//         res.status(500).json({ erro: "Erro ao criptografar senha." });
//     }
// });

app.post('/api/auth/registrar', async (req, res) => {
    const { nome, email, senha, tipo } = req.body; // 'tipo' define a tabela destino

    // Valida se o tipo enviado é válido
    const tiposPermitidos = ['aluno', 'professor', 'admin'];
    const tabelaDestino = tiposPermitidos.includes(tipo) ? (tipo === 'admin' ? 'admins' : `${tipo}s`) : 'alunos';

    try {
        const senhaHash = await bcrypt.hash(senha, 10);
        const query = `INSERT INTO ${tabelaDestino} (nome, email, senha) VALUES (?, ?, ?)`;

        db.run(query, [nome, email, senhaHash], function(err) {
            if (err) {
                return res.status(400).json({ erro: "Este e-mail já está cadastrado." });
            }
            res.status(201).json({ 
                mensagem: "Usuário cadastrado com sucesso!", 
                id: this.lastID,
                tipo: tipo || 'aluno'
            });
        });
    } catch (e) {
        res.status(500).json({ erro: "Erro ao criptografar senha." });
    }
});

// --- ROTAS ACADÊMICAS ---

app.get('/api/disciplinas', (req, res) => {
    db.all("SELECT * FROM disciplinas", [], (err, rows) => {
        if (err) return res.status(500).json({ erro: err.message });
        res.json(rows);
    });
});

app.post('/api/disciplinas', (req, res) => {
    const { codigo, nome, cargaHoraria } = req.body;
    db.run("INSERT INTO disciplinas (codigo, nome, cargaHoraria) VALUES (?, ?, ?)", [codigo, nome, cargaHoraria], function(err) {
        if (err) return res.status(400).json({ erro: "Erro ao cadastrar disciplina (código duplicado?)." });
        res.json({ mensagem: "Disciplina cadastrada com sucesso!" });
    });
});

// Rota DELETE de disciplinas com exclusão em cascata segura
app.delete('/api/disciplinas/:codigo', (req, res) => {
    const { codigo } = req.params;
    
    db.serialize(() => {
        db.run("DELETE FROM matriculas WHERE turmaId IN (SELECT id FROM turmas WHERE codigoDisciplina = ?)", [codigo], (err) => {
            if (err) console.error("Erro ao limpar matrículas:", err);
            
            db.run("DELETE FROM turmas WHERE codigoDisciplina = ?", [codigo], (err) => {
                if (err) console.error("Erro ao limpar turmas:", err);
                
                db.run("DELETE FROM disciplinas WHERE codigo = ?", [codigo], function(err) {
                    if (err) return res.status(500).json({ erro: err.message });
                    if (this.changes === 0) {
                        return res.status(404).json({ erro: "Disciplina não encontrada." });
                    }
                    res.json({ mensagem: "Disciplina e seus vínculos excluídos com sucesso!" });
                });
            });
        });
    });
});

app.get('/api/turmas', (req, res) => {
    const query = `
        SELECT 
            turmas.id, 
            turmas.codigoDisciplina, 
            turmas.idProfessor, 
            professores.nome AS nomeProfessor,
            turmas.dia, 
            turmas.turno, 
            turmas.horario, 
            turmas.vagasTotais, 
            turmas.vagasOcupadas 
        FROM turmas
        LEFT JOIN professores ON turmas.idProfessor = professores.id
    `;
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ erro: err.message });
        res.json(rows);
    });
});

app.post('/api/turmas', (req, res) => {
    
    const { codigoDisciplina, idProfessor, dia, turno, horario, vagasTotais } = req.body;
    const horarioFinal = (horario && horario.trim() !== "") ? horario : "08:00-09:40";
    db.run("INSERT INTO turmas (codigoDisciplina, idProfessor, dia, turno, horario, vagasTotais, vagasOcupadas) VALUES (?, ?, ?, ?, ?, ?, 0)",
        [codigoDisciplina, idProfessor, dia, turno, horarioFinal, vagasTotais], function(err) {
            if (err) return res.status(400).json({ erro: err.message });
            res.json({ mensagem: "Turma ofertada com sucesso!", id: this.lastID });
        });
});

app.delete('/api/turmas/:id', (req, res) => {
    const { id } = req.params;
    db.serialize(() => {
        db.run("DELETE FROM matriculas WHERE turmaId = ?", [id]);
        db.run("DELETE FROM turmas WHERE id = ?", [id], function(err) {
            if (err) return res.status(500).json({ erro: err.message });
            res.json({ mensagem: "Turma excluída com sucesso!" });
        });
    });
});

app.get('/api/matriculas/:alunoId', (req, res) => {
    const { alunoId } = req.params;
    db.all("SELECT turmaId FROM matriculas WHERE alunoId = ?", [alunoId], (err, rows) => {
        if (err) return res.status(500).json({ erro: err.message });
        res.json(rows.map(r => r.turmaId));
    });
});

app.post('/api/matriculas', (req, res) => {
    const { alunoId, turmaId } = req.body;

    db.get("SELECT * FROM turmas WHERE id = ?", [turmaId], (err, turmaAlvo) => {
        if (err || !turmaAlvo) return res.status(404).json({ erro: "Turma não encontrada." });

        if (turmaAlvo.vagasOcupadas >= turmaAlvo.vagasTotais) {
            return res.status(400).json({ erro: "Turma lotada!" });
        }

        db.all(`SELECT t.* FROM matriculas m JOIN turmas t ON m.turmaId = t.id WHERE m.alunoId = ?`, [alunoId], (err, turmasMatriculadas) => {
            const conflito = turmasMatriculadas.some(t => t.dia === turmaAlvo.dia && t.turno === turmaAlvo.turno);
            
            if (conflito) {
                return res.status(400).json({ erro: "Conflito de horário! Você já possui outra turma neste mesmo dia e turno." });
            }

            db.serialize(() => {
                db.run("INSERT INTO matriculas (alunoId, turmaId) VALUES (?, ?)", [alunoId, turmaId]);
                db.run("UPDATE turmas SET vagasOcupadas = vagasOcupadas + 1 WHERE id = ?", [turmaId], (err) => {
                    if (err) return res.status(500).json({ erro: err.message });
                    res.json({ mensagem: "Matrícula realizada com sucesso!" });
                });
            });
        });
    });
});

app.delete('/api/matriculas/:alunoId/:turmaId', (req, res) => {
    const { alunoId, turmaId } = req.params;
    db.run("DELETE FROM matriculas WHERE alunoId = ? AND turmaId = ?", [alunoId, turmaId], function(err) {
        if (err) return res.status(500).json({ erro: err.message });
        db.run("UPDATE turmas SET vagasOcupadas = MAX(0, vagasOcupadas - 1) WHERE id = ?", [turmaId], () => {
            res.json({ mensagem: "Matrícula cancelada com sucesso!" });
        });
    });
});

// ==========================================
// ROTAS DE GESTÃO DE ALUNOS (ADMIN)
// ==========================================

app.post('/api/alunos', async (req, res) => {
    const { nome, email } = req.body;

    if (!nome || !email) {
        return res.status(400).json({ error: 'Nome e e-mail são obrigatórios.' });
    }

    try {
        const senhaHash = await bcrypt.hash("123456", 10);
        const query = `INSERT INTO alunos (nome, email, senha) VALUES (?, ?, ?)`;
        
        db.run(query, [nome, email, senhaHash], function(err) {
            if (err) {
                return res.status(500).json({ error: 'Erro ao cadastrar aluno (E-mail já cadastrado?).' });
            }
            res.status(201).json({ 
                id: this.lastID, 
                nome, 
                email,                 
                mensagem: 'Aluno cadastrado com sucesso! Senha padrão: 123456' 
            });
        });
    } catch (error) {
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
});

app.get('/api/alunos', (req, res) => {
    db.all(`SELECT id, nome, email FROM alunos`, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Erro ao buscar alunos.' });
        }
        res.json(rows);
    });
});


// ==========================================
// EXCLUIR ALUNO (ADMIN)
// ==========================================

app.delete('/api/alunos/:id', (req, res) => {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({
            error: 'ID do aluno inválido.'
        });
    }

    const query = `
        DELETE FROM alunos
        WHERE id = ?
    `;

    db.run(query, [id], function(err) {
        if (err) {
            console.error('Erro ao excluir aluno:', err);

            return res.status(500).json({
                error: 'Erro ao excluir aluno. Verifique se existem matrículas vinculadas.'
            });
        }

        if (this.changes === 0) {
            return res.status(404).json({
                error: 'Aluno não encontrado.'
            });
        }

        return res.json({
            mensagem: 'Aluno excluído com sucesso!',
            id: id
        });
    });
});

// ==========================================
// ROTAS DE GESTÃO DE PROFESSORES (ADMIN)
// ==========================================

app.post('/api/gestaoprofessores', async (req, res) => {
    const { nome, email } = req.body;

    if (!nome || !email) {
        return res.status(400).json({ error: 'Nome e e-mail são obrigatórios.' });
    }

    try {
        const senhaHash = await bcrypt.hash("123456", 10);
        const query = `INSERT INTO professores (nome, email, senha) VALUES (?, ?, ?)`;
        
        db.run(query, [nome, email, senhaHash], function(err) {
            if (err) {
                return res.status(500).json({ error: 'Erro ao cadastrar professor (E-mail já cadastrado?).' });
            }
            res.status(201).json({ 
                id: this.lastID, 
                nome, 
                email,                 
                mensagem: 'Professor cadastrado com sucesso! Senha padrão: 123456' 
            });
        });
    } catch (error) {
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
});

app.get('/api/gestaoprofessores', (req, res) => {
    db.all(`SELECT id, nome, email FROM professores`, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Erro ao buscar professor.' });
        }
        res.json(rows);
    });
});

// ==========================================
// EXCLUIR PROFESSOR (ADMIN)
// ==========================================

app.delete('/api/gestaoprofessores/:id', (req, res) => {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({
            error: 'ID do professor inválido.'
        });
    }

    const query = `
        DELETE FROM professores
        WHERE id = ?
    `;

    db.run(query, [id], function(err) {
        if (err) {
            console.error('Erro ao excluir professor:', err);

            return res.status(500).json({
                error: 'Erro ao excluir professor. Verifique se existem matrículas vinculadas.'
            });
        }

        if (this.changes === 0) {
            return res.status(404).json({
                error: 'Professor não encontrado.'
            });
        }

        return res.json({
            mensagem: 'Professor excluído com sucesso!',
            id: id
        });
    });
});



app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});