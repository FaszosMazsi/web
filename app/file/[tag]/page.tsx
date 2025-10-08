'use client';

function getFileInfo(params: { tag: string }) {
   const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://weber3.vercel.app/';
  const url = `${baseUrl}/files/${params.tag}`;
  return fetch(url)
    .then((response) => response.json())
    .then((data) => {
      // Process file information
      console.log("File information:", data);
      return data;
    })
    .catch((error) => {
      console.error("Error fetching file information:", error);
      return null;
    });
}


async function displayFileInfo(fileTag: string) {
  const fileInfo = await getFileInfo({ tag: fileTag });
  if (fileInfo) {
    // Display file information on the UI
    const fileInfoDiv = document.getElementById("fileInfo");
    fileInfoDiv.innerHTML = `
      <h3>File Name: ${fileInfo.name}</h3>
      <p>File Size: ${fileInfo.size}</p>
      <p>File Type: ${fileInfo.type}</p>
    `;
  } else {
    // Handle error
    const fileInfoDiv = document.getElementById("fileInfo");
    fileInfoDiv.innerHTML = "<p>Error fetching file information.</p>";
  }
}

import React, { useEffect } from 'react';

export default function FilePage({ params }: { params: { tag: string } }) {
    useEffect(() => {
        // A document hívást is tartalmazó függvényt ITT hívod meg
        displayFileInfo(params.tag); 
    }, [params.tag]);

    return (
        // Itt van az a HTML, amiben az "fileInfo" ID-t keresi a document hívás
        <div id="fileInfo">Betöltés...</div>
    );
}


// Example usage
displayFileInfo("my-file-tag");

