PDF Editor PWA - arquivos iniciais

1. Envie TODOS os arquivos para a raiz do repositório GitHub Pages.
2. Adicione dois ícones PNG: icon-192.png e icon-512.png (ou remova os ícones do manifest temporariamente).
3. Ative Settings > Pages > Deploy from a branch > main > /(root).
4. Abra o endereço HTTPS publicado no Chrome Android e use "Instalar app".
5. Depois de instalado, teste Compartilhar > PDF Editor com um PDF.

Observações:
- PDF.js e pdf-lib são carregados por CDN, então a primeira abertura precisa de internet.
- O compartilhamento de arquivos por PWA depende do suporte do navegador/Android e deve ser testado no aparelho.
- Este primeiro protótipo permite visualizar, girar páginas e excluir páginas. A exclusão/giro são aplicados ao baixar o PDF editado.
- Este protótipo ainda não implementa edição de texto original nem anotações.
