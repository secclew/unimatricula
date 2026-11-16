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
        db.run("PRAGMA foreign_keys = ON;");
        criarTabelasESeed();
    }
});

// Criar tabelas e usuários iniciais com Hash (sem dados acadêmicos pré-cadastrados)
function criarTabelasESeed() {
    db.serialize(async () => {
        db.run(`CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            senha TEXT NOT NULL,
            perfil TEXT NOT NULL -- 'aluno' ou 'instituicao'
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS disciplinas (
            codigo TEXT PRIMARY KEY,
            nome TEXT NOT NULL,
            cargaHoraria INTEGER NOT NULL
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS turmas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            codigoDisciplina TEXT,
            professor TEXT,
            dia INTEGER,
            turno INTEGER,
            horario TEXT,
            vagasTotais INTEGER,
            vagasOcupadas INTEGER DEFAULT 0,
            FOREIGN KEY(codigoDisciplina) REFERENCES disciplinas(codigo)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS matriculas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            alunoId INTEGER,
            turmaId INTEGER,
            FOREIGN KEY(alunoId) REFERENCES usuarios(id),
            FOREIGN KEY(turmaId) REFERENCES turmas(id)
        )`);

        // Inserir usuários padrão se a tabela estiver vazia (Senha padrão criptografada: '123456')
        db.get("SELECT COUNT(*) as count FROM usuarios", async (err, row) => {
            if (row && row.count === 0) {
                const senhaHash = await bcrypt.hash("123456", 10);
                
                // Usuário Aluno Padrão
                db.run("INSERT INTO usuarios (nome, email, senha, perfil) VALUES (?, ?, ?, ?)",
                    ["Aluno Exemplo", "aluno@unimatricula.br", senhaHash, "aluno"]
                );
                
                // Usuário Instituição / Gestor Padrão
                db.run("INSERT INTO usuarios (nome, email, senha, perfil) VALUES (?, ?, ?, ?)", 
                    ["Coordenação Acadêmica", "admin@unimatricula.br", senhaHash, "instituicao"]
                );

                console.log("Banco de dados inicializado com usuários padrão (aluno e admin).");
            }
        });
    });
}

// ==========================================
// ROTAS DE AUTENTICAÇÃO
// ==========================================

app.post('/api/auth/login', (req, res) => {
    const { email, senha } = req.body;

    db.get("SELECT * FROM usuarios WHERE email = ?", [email], async (err, usuario) => {
        if (err || !usuario) {
            return res.status(401).json({ erro: "E-mail ou senha inválidos." });
        }

        const senhaValida = await bcrypt.compare(senha, usuario.senha);
        if (!senhaValida) {
            return res.status(401).json({ erro: "E-mail ou senha inválidos." });
        }

        res.json({
            id: usuario.id,
            nome: usuario.nome,
            email: usuario.email,
            perfil: usuario.perfil
        });
    });
});

app.post('/api/auth/registrar', async (req, res) => {
    const { nome, email, senha, perfil } = req.body;

    try {
        const senhaHash = await bcrypt.hash(senha, 10);
        db.run("INSERT INTO usuarios (nome, email, senha, perfil) VALUES (?, ?, ?, ?)",
            [nome, email, senhaHash, perfil || 'aluno'], function(err) {
                if (err) {
                    return res.status(400).json({ erro: "Este e-mail já está cadastrado." });
                }
                res.json({ mensagem: "Usuário cadastrado com sucesso!", id: this.lastID });
            });
    } catch (e) {
        res.status(500).json({ erro: "Erro ao criptografar senha." });
    }
});

// ==========================================
// ROTAS ACADÊMICAS (CONSULTA E CADASTRO)
// ==========================================

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

app.get('/api/turmas', (req, res) => {
    db.all("SELECT * FROM turmas", [], (err, rows) => {
        if (err) return res.status(500).json({ erro: err.message });
        res.json(rows);
    });
});

app.post('/api/turmas', (req, res) => {
    const { codigoDisciplina, professor, dia, turno, horario, vagasTotais } = req.body;
    const horarioFinal = (horario && horario.trim() !== "") ? horario : "08:00-09:40";
    db.run("INSERT INTO turmas (codigoDisciplina, professor, dia, turno, horario, vagasTotais, vagasOcupadas) VALUES (?, ?, ?, ?, ?, ?, 0)",
        [codigoDisciplina, professor, dia, turno, horarioFinal, vagasTotais], function(err) {
            if (err) return res.status(400).json({ erro: err.message });
            res.json({ mensagem: "Turma ofertada com sucesso!", id: this.lastID });
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

// ==========================================
// ROTAS DE GESTÃO ADMINISTRATIVA (LISTAGEM E CADASTRO)
// ==========================================

app.post('/api/alunos', async (req, res) => {
    const { nome, email } = req.body;

    if (!nome || !email) {
        return res.status(400).json({ error: 'Nome e e-mail são obrigatórios.' });
    }

    try {
        const senhaHash = await bcrypt.hash("123456", 10);
        const query = `INSERT INTO usuarios (nome, email, senha, perfil) VALUES (?, ?, ?, 'aluno')`;
        
        db.run(query, [nome, email, senhaHash], function(err) {
            if (err) {
                return res.status(500).json({ error: 'Erro ao cadastrar aluno (E-mail já cadastrado?).' });
            }
            res.status(201).json({ 
                id: this.lastID, 
                nome, 
                email, 
                perfil: 'aluno',
                mensagem: 'Aluno cadastrado com sucesso! Senha padrão: 123456' 
            });
        });
    } catch (error) {
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
});

app.get('/api/alunos', (req, res) => {
    db.all(`SELECT id, nome, email FROM usuarios WHERE perfil = 'aluno'`, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Erro ao buscar alunos.' });
        }
        res.json(rows);
    });
});

app.get('/api/matriculas-admin', (req, res) => {
    const query = `
        SELECT m.id, 
               u.nome as aluno, 
               d.nome as disciplina, 
               t.professor, 
               t.dia, 
               t.horario, 
               t.turno 
        FROM matriculas m
        JOIN usuarios u ON m.alunoId = u.id
        JOIN turmas t ON m.turmaId = t.id
        JOIN disciplinas d ON t.codigoDisciplina = d.codigo
    `;

    db.all(query, [], (err, rows) => {
        if (err) {
            console.error("Erro ao buscar matrículas:", err);
            return res.status(500).json({ error: "Erro ao buscar matrículas no servidor." });
        }
        res.json(rows);
    });
});

// ==========================================
// ROTAS DE EXCLUSÃO SEGURAS (CONSOLIDADAS)
// ==========================================

// 1. Cancelar Matrícula (Painel do Aluno)
app.delete('/api/matriculas/:alunoId/:turmaId', (req, res) => {
    const { alunoId, turmaId } = req.params;
    db.run("DELETE FROM matriculas WHERE alunoId = ? AND turmaId = ?", [alunoId, turmaId], function(err) {
        if (err) return res.status(500).json({ erro: err.message });
        db.run("UPDATE turmas SET vagasOcupadas = MAX(0, vagasOcupadas - 1) WHERE id = ?", [turmaId], () => {
            res.json({ mensagem: "Matrícula cancelada com sucesso!" });
        });
    });
});

// 2. Excluir Matrícula (Painel Admin) e liberar vaga na turma
app.delete('/api/matriculas/:id', (req, res) => {
    const { id } = req.params;

    db.get("SELECT turmaId FROM matriculas WHERE id = ?", [id], (err, row) => {
        if (err) return res.status(500).json({ error: "Erro ao localizar matrícula." });
        if (!row) return res.status(404).json({ error: "Matrícula não encontrada." });

        const turmaId = row.turmaId;

        db.serialize(() => {
            db.run("DELETE FROM matriculas WHERE id = ?", [id], function(err) {
                if (err) return res.status(500).json({ error: "Erro ao excluir matrícula no banco de dados." });

                db.run("UPDATE turmas SET vagasOcupadas = MAX(0, vagasOcupadas - 1) WHERE id = ?", [turmaId], () => {
                    res.json({ mensagem: "Matrícula excluída e vaga liberada com sucesso!", idExcluido: id });
                });
            });
        });
    });
});

// 3. Excluir Aluno (bloqueia se houver matrículas ativas)
app.delete('/api/alunos/:id', (req, res) => {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: 'ID do aluno inválido.' });
    }

    db.get("SELECT COUNT(*) as total FROM matriculas WHERE alunoId = ?", [id], (err, row) => {
        if (err) return res.status(500).json({ error: 'Erro ao verificar matrículas do aluno.' });

        if (row.total > 0) {
            return res.status(400).json({ 
                error: 'Não é possível excluir este aluno pois ele possui matrículas ativas. Remova as matrículas primeiro.' 
            });
        }

        db.run("DELETE FROM usuarios WHERE id = ? AND perfil = 'aluno'", [id], function(err) {
            if (err) return res.status(500).json({ error: 'Erro ao excluir aluno.' });
            if (this.changes === 0) return res.status(404).json({ error: 'Aluno não encontrado.' });

            return res.json({ mensagem: 'Aluno excluído com sucesso!', id: id });
        });
    });
});

// 4. Excluir Turma (bloqueia se houver alunos matriculados)
app.delete('/api/turmas/:id', (req, res) => {
    const { id } = req.params;
    
    db.get("SELECT COUNT(*) as total FROM matriculas WHERE turmaId = ?", [id], (err, row) => {
        if (err) return res.status(500).json({ erro: err.message });
        
        if (row.total > 0) {
            return res.status(400).json({ erro: "Não é possível excluir uma turma que possui alunos matriculados." });
        }

        db.run("DELETE FROM turmas WHERE id = ?", [id], function(err) {
            if (err) return res.status(500).json({ erro: err.message });
            res.json({ mensagem: "Turma excluída com sucesso!" });
        });
    });
});

// 5. Excluir Disciplina por código (bloqueia se houver turmas vinculadas)
app.delete('/api/disciplinas/:codigo', (req, res) => {
    const codigoDisciplina = req.params.codigo;

    db.get("SELECT COUNT(*) as total FROM turmas WHERE codigoDisciplina = ?", [codigoDisciplina], (err, row) => {
        if (err) return res.status(500).json({ error: "Erro ao verificar dependências da disciplina." });

        if (row.total > 0) {
            return res.status(400).json({ 
                error: "Não é possível excluir esta disciplina pois existem turmas vinculadas a ela." 
            });
        }

        db.run("DELETE FROM disciplinas WHERE codigo = ?", [codigoDisciplina], function(err) {
            if (err) return res.status(500).json({ error: "Erro ao excluir a disciplina no banco de dados." });
            if (this.changes === 0) return res.status(404).json({ error: "Disciplina não encontrada." });

            res.json({ mensagem: "Disciplina excluída com sucesso!" });
        });
    });
});

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});