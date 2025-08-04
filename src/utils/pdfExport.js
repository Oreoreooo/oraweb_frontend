import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export const exportDiaryToPDF = async (diary) => {
  try {
    // Create a temporary div to render the diary content
    const tempDiv = document.createElement('div');
    tempDiv.style.cssText = `
      position: absolute;
      top: -9999px;
      left: -9999px;
      width: 800px;
      padding: 40px;
      background: white;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 14px;
      line-height: 1.6;
      color: #333;
    `;

    // Create the HTML content for the diary
    const formattedDate = new Date(diary.date || diary.created_at).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    let htmlContent = `
      <div style="margin-bottom: 30px; border-bottom: 2px solid #eee; padding-bottom: 20px;">
        <h1 style="font-size: 24px; margin-bottom: 10px; color: #2c3e50;">${diary.title}</h1>
        <div style="font-size: 12px; color: #666; margin-bottom: 20px;">
          <strong>Date:</strong> ${formattedDate}
        </div>
      </div>
      
      <div style="margin-bottom: 30px;">
        <h2 style="font-size: 18px; margin-bottom: 15px; color: #34495e;">Content</h2>
        <div style="white-space: pre-wrap; line-height: 1.8;">${diary.content}</div>
      </div>
    `;

    // Add chat history if it exists
    if (diary.messages && diary.messages.length > 1) {
      htmlContent += `
        <div style="margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
          <h2 style="font-size: 18px; margin-bottom: 15px; color: #34495e;">Chat History</h2>
      `;

      const chatMessages = diary.messages.filter(message => message.role !== 'system');
      
      chatMessages.forEach((message, index) => {
        const isUser = message.role === 'user';
        const roleColor = isUser ? '#3498db' : '#e74c3c';
        const roleName = isUser ? 'You' : 'Ora';
        
        htmlContent += `
          <div style="margin-bottom: 15px; padding: 15px; background: ${isUser ? '#f8f9fa' : '#fff5f5'}; border-left: 4px solid ${roleColor}; border-radius: 4px;">
            <div style="font-weight: bold; color: ${roleColor}; margin-bottom: 5px; font-size: 12px;">${roleName}</div>
            <div style="white-space: pre-wrap;">${message.content}</div>
          </div>
        `;
      });

      htmlContent += `</div>`;
    }

    tempDiv.innerHTML = htmlContent;
    document.body.appendChild(tempDiv);

    // Convert to canvas
    const canvas = await html2canvas(tempDiv, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff'
    });

    // Remove temporary div
    document.body.removeChild(tempDiv);

    // Create PDF
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgData = canvas.toDataURL('image/png');
    
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    
    // Calculate scaling to fit the page
    const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
    const scaledWidth = imgWidth * ratio;
    const scaledHeight = imgHeight * ratio;
    
    // Center the content
    const x = (pdfWidth - scaledWidth) / 2;
    const y = (pdfHeight - scaledHeight) / 2;

    // If content is too tall, we need to handle multiple pages
    if (scaledHeight > pdfHeight) {
      // Calculate how many pages we need
      const pageHeight = pdfHeight;
      const totalPages = Math.ceil(scaledHeight / pageHeight);
      
      for (let i = 0; i < totalPages; i++) {
        if (i > 0) {
          pdf.addPage();
        }
        
        const sourceY = (imgHeight / totalPages) * i;
        const sourceHeight = Math.min(imgHeight / totalPages, imgHeight - sourceY);
        
        // Create a new canvas for this page
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = imgWidth;
        pageCanvas.height = sourceHeight;
        const pageCtx = pageCanvas.getContext('2d');
        
        pageCtx.drawImage(canvas, 0, sourceY, imgWidth, sourceHeight, 0, 0, imgWidth, sourceHeight);
        
        const pageImgData = pageCanvas.toDataURL('image/png');
        const pageScaledHeight = sourceHeight * ratio;
        
        pdf.addImage(pageImgData, 'PNG', x, 0, scaledWidth, pageScaledHeight);
      }
    } else {
      pdf.addImage(imgData, 'PNG', x, y, scaledWidth, scaledHeight);
    }

    // Generate filename
    const safeTitle = diary.title.replace(/[^a-zA-Z0-9]/g, '_');
    const dateStr = new Date(diary.date || diary.created_at).toISOString().split('T')[0];
    const filename = `diary_${safeTitle}_${dateStr}.pdf`;

    // Save the PDF
    pdf.save(filename);

    return true;
  } catch (error) {
    console.error('Error exporting diary to PDF:', error);
    throw error;
  }
};

export const exportMultipleDiariesToPDF = async (diaries) => {
  try {
    if (!diaries || diaries.length === 0) {
      throw new Error('No diaries to export');
    }

    const pdf = new jsPDF('p', 'mm', 'a4');
    
    for (let i = 0; i < diaries.length; i++) {
      const diary = diaries[i];
      
      if (i > 0) {
        pdf.addPage();
      }

      // Create temporary div for this diary
      const tempDiv = document.createElement('div');
      tempDiv.style.cssText = `
        position: absolute;
        top: -9999px;
        left: -9999px;
        width: 800px;
        padding: 40px;
        background: white;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-size: 14px;
        line-height: 1.6;
        color: #333;
      `;

      const formattedDate = new Date(diary.date || diary.created_at).toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      let htmlContent = `
        <div style="margin-bottom: 30px; border-bottom: 2px solid #eee; padding-bottom: 20px;">
          <h1 style="font-size: 24px; margin-bottom: 10px; color: #2c3e50;">${diary.title}</h1>
          <div style="font-size: 12px; color: #666; margin-bottom: 20px;">
            <strong>Date:</strong> ${formattedDate}
          </div>
        </div>
        
        <div style="margin-bottom: 30px;">
          <h2 style="font-size: 18px; margin-bottom: 15px; color: #34495e;">Content</h2>
          <div style="white-space: pre-wrap; line-height: 1.8;">${diary.content}</div>
        </div>
      `;

      // Add chat history if it exists (simplified for multi-diary export)
      if (diary.messages && diary.messages.length > 1) {
        const chatMessages = diary.messages.filter(message => message.role !== 'system');
        htmlContent += `
          <div style="margin-top: 20px; border-top: 1px solid #eee; padding-top: 15px;">
            <h3 style="font-size: 16px; margin-bottom: 10px; color: #34495e;">Chat Summary</h3>
            <div style="font-size: 12px; color: #666;">${chatMessages.length} chat messages</div>
          </div>
        `;
      }

      tempDiv.innerHTML = htmlContent;
      document.body.appendChild(tempDiv);

      // Convert to canvas
      const canvas = await html2canvas(tempDiv, {
        scale: 1.5,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      });

      document.body.removeChild(tempDiv);

      // Add to PDF
      const imgData = canvas.toDataURL('image/png');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const scaledWidth = imgWidth * ratio;
      const scaledHeight = imgHeight * ratio;
      
      const x = (pdfWidth - scaledWidth) / 2;
      const y = (pdfHeight - scaledHeight) / 2;

      pdf.addImage(imgData, 'PNG', x, y, scaledWidth, scaledHeight);
    }

    // Generate filename
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `diary_collection_${dateStr}.pdf`;

    pdf.save(filename);

    return true;
  } catch (error) {
    console.error('Error exporting multiple diaries to PDF:', error);
    throw error;
  }
};
