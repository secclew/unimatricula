
# UniMatrícula — Sistema de Atendimento e Matrículas

## 1. Descrição

O UniMatrícula é uma aplicação web desenvolvida para demonstrar
o processo de oferta de turmas e matrícula em disciplinas
de uma instituição de ensino superior.

O projeto apresenta uma interface para consulta de ofertas,
realização de matrículas, cadastro de disciplinas e
gerenciamento de turmas.

## 2. Objetivos

- Desenvolver uma interface web dinâmica.
- Aplicar conhecimentos de HTML5, CSS3 e JavaScript.
- Utilizar Bootstrap para a construção dos componentes visuais.
- Implementar validações para o processo de matrícula.
- Armazenar dados no navegador usando localStorage.

## 3. Tecnologias

- HTML5
- CSS3
- JavaScript
- Bootstrap 5
- Bootstrap Icons
- LocalStorage

## 4. Funcionalidades

1. Visualização do painel acadêmico.
2. Consulta e filtragem de ofertas de turmas.
3. Realização de matrículas.
4. Cancelamento de matrículas.
5. Cadastro e exclusão de disciplinas.
6. Criação e exclusão de ofertas de turmas.
7. Validação de vagas disponíveis.
8. Prevenção de matrículas duplicadas.
9. Verificação de conflitos de horários.
10. Persistência local dos dados.

## 5. Como executar

1. Baixe ou extraia a pasta do projeto.
2. Abra a pasta `unimatricula` no Visual Studio Code.
3. Verifique se os arquivos index.html, style.css e app.js
   estão na mesma pasta.
4. Abra o arquivo index.html em um navegador.
5. Mantenha uma conexão com a internet para carregar o Bootstrap
   e os ícones pelas bibliotecas CDN.

Também é possível executar o projeto usando a extensão
Live Server do Visual Studio Code.

## 6. Armazenamento

Os dados são armazenados no localStorage do navegador.
O sistema utiliza dados fictícios para demonstração.

O armazenamento é local ao navegador e à origem utilizada.
Não existe sincronização entre computadores ou usuários.

## 7. Limitações

- Não possui autenticação real.
- Não possui banco de dados remoto.
- Não possui integração com API.
- Os dados são demonstrativos.
- Não deve ser utilizado para matrículas reais.

## 8. Estrutura

- index.html: estrutura da interface.
- style.css: estilos e responsividade.
- app.js: regras de negócio e persistência.
- docs/: planejamento e documentação.

## 9. Contexto acadêmico

Projeto acadêmico da Atividade Acadêmica de desenvolvimento
front-end, com tema de atendimento e matrículas universitárias.

######

# UniMatrícula 🎓

Sistema full-stack de atendimento, gestão acadêmica e matrículas desenvolvido como entrega da Semana 6.

---

## 🚀 Tecnologias Utilizadas

- **Front-end:** HTML5, CSS3, JavaScript (Vanilla), Bootstrap 5, Bootstrap Icons
- **Back-end:** Node.js, Express
- **Banco de Dados Relacional:** SQLite (`unimatricula.db`)
- **Segurança:** Bcrypt (para criptografia segura de senhas)

---

## 📋 Pré-requisitos

Antes de começar, certifique-se de ter instalado em sua máquina:
- [Node.js](https://nodejs.org/) (versão 16 ou superior recomendada)
- Git

---


Instale as dependências:
O gestor de pacotes do Node (npm) irá descarregar automaticamente todas as bibliotecas necessárias (Express, SQLite3, Bcrypt, etc.) listadas no arquivo de configuração:

Bash
npm install

Inicie o servidor:

Bash
npm start

Acesse no navegador:
Abra o seu navegador (ex: Firefox ou Chrome) e entre em:
 http://localhost:3000

 Credenciais de Acesso (Para Testes)
O sistema já inicializa com usuários de teste cadastrados no banco de dados SQLite:

Perfil Gestor / Instituição:

E-mail: admin@unimatricula.br

Senha: 123456

Perfil Aluno:

E-mail: aluno@unimatricula.br

Senha: 123456

Perfil do professor:

E-mail: professor@unimatricula.br

Senha: 123456

Funcionalidades Principais (CRUD & Regras)
Visão Institucional: O gestor pode cadastrar disciplinas, ofertar turmas (definindo professor, vagas, dia e turno codificado) e gerenciar o fluxo acadêmico. Possui travas de integridade para impedir a exclusão de disciplinas com turmas ativas.

Visão do Aluno: O aluno pode navegar pelas turmas abertas, verificar vagas em tempo real e realizar ou cancelar as suas matrículas.

UX Moderna: Interface limpa construída com Bootstrap 5, incluindo suporte a alternância de visibilidade de senha (mostrar/ocultar).

Grupo01:
Paula Antunes
Erick Jordan
João Paulo Witusk
Eduardo Bastos Lewandowski