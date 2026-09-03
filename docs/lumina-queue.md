# Fila distribuída do Lumina

O lançamento de notas usa a tabela `public.lumina_jobs` como fila compartilhada. O usuário apenas cria um pedido; cada máquina Windows executa um worker que reserva atomicamente o próximo pedido disponível. Não é necessário escolher IP ou porta de uma máquina.

## 1. Banco

Aplique a migração:

`supabase/migrations/20260819130000_create_lumina_jobs_queue.sql`

No ambiente Lovable/Supabase, confirme que a migração foi aplicada antes de testar o botão **Lançar Notas**.

## 2. Variáveis em cada máquina Windows

As duas máquinas usam o mesmo projeto Supabase e a mesma chave de serviço. O identificador do worker precisa ser diferente:

### Máquina 01

```env
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=chave-de-servico
LINKAI_LUMINA_CREDENTIALS_KEY=mesmo-segredo-do-Lovable
LINKAI_WORKER_ID=lumina-maquina-01
LINKAI_QUEUE_WORKER_ENABLED=true
LINKAI_QUEUE_POLL_SECONDS=3
LINKAI_QUEUE_LEASE_SECONDS=300
LUMINA_EXECUTABLE_PATH=C:\caminho\para\900_Lumina.exe
```

### Máquina 02

Use o mesmo bloco, trocando somente:

```env
LINKAI_WORKER_ID=lumina-maquina-02
LUMINA_EXECUTABLE_PATH=C:\caminho\para\900_Lumina.exe
```

A chave `SUPABASE_SERVICE_ROLE_KEY` é administrativa e nunca deve ser colocada no frontend, no Lovable como variável pública ou versionada no Git.

## 3. Iniciar o worker

Em cada máquina, no diretório do projeto:

```powershell
cd C:\LinkAI
.\lumina_bot\.venv\Scripts\python.exe -m uvicorn backend.api.server:app --host 0.0.0.0 --port 8766
```

O worker inicia automaticamente com a API. Verifique:

```powershell
curl.exe http://127.0.0.1:8766/health
```

A resposta deve conter `queue_worker.enabled=true`, o `worker_id` da máquina e `running=true`.

## 4. Fluxo

1. O usuário clica em **Iniciar lançamento**.
2. A aplicação grava um item com status `queued`.
3. A primeira máquina livre executa `claim_lumina_job` e muda o item para `running`.
4. Enquanto o Lumina estiver aberto, o worker renova a reserva.
5. Ao fechar o Lumina, o item vira `succeeded` e a máquina fica disponível para o próximo pedido.
6. Se uma máquina cair, a reserva expira e outra pode assumir o item, respeitando o limite de tentativas.

O endpoint antigo `lumina.start` continua disponível para compatibilidade, mas a tela atual de lançamento usa exclusivamente a fila.

`LINKAI_LUMINA_CREDENTIALS_KEY` deve ser exatamente igual no ambiente seguro
do Lovable e nas duas máquinas. Ela protege a senha Lumina individual de cada
usuário. Nunca coloque esse valor no frontend, em uma variável `VITE_*` ou no
Git. O usuário cadastra seu login Lumina na primeira utilização de **Iniciar
lançamento**; depois, o estado fica disponível em **Meu Perfil**. A troca
posterior é encaminhada ao suporte técnico pelo botão **Alterar login Lumina**.

## 5. Ambiente publicado

No ambiente seguro do Lovable, configure `LINKAI_LUMINA_CREDENTIALS_KEY` com
um segredo aleatório forte. Use o mesmo valor nos arquivos `.env` das máquinas
01 e 02. Reinicie a API/worker após alterar o `.env` para que o processo leia a
nova configuração.

