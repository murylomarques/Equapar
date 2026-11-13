/**
 * A5: formulário do CNPJ sem JavaScript, para o topo da landing e os guias. Envia GET /raio-x?cnpj=...;
 * a página do Raio-X aceita qualquer formato (com ou sem pontuação) e mostra o erro se o CNPJ não existir.
 * A versão com máscara e validação ao digitar (form-cnpj.tsx) fica na própria página do Raio-X.
 */
export function FormCnpjServidor({ id, escuro }: { id: string; escuro?: boolean }) {
  return (
    <form action="/raio-x" method="get">
      <label htmlFor={id} className="rotulo" style={{ display: "block", marginBottom: 6, color: escuro ? "#fff" : undefined }}>
        CNPJ da empresa
      </label>
      <div className="form-cnpj">
        <div className="entrada" style={{ flex: "1 1 240px" }}>
          <input id={id} name="cnpj" autoComplete="off" placeholder="00.000.000/0000-00" className="tnum" required maxLength={20} />
        </div>
        <button className="btn btn-primario" type="submit">
          Ver meus contratos
        </button>
      </div>
    </form>
  );
}
