
import { GoogleGenAI } from "@google/genai";
import { Expense, Apartment } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function analyzeFinances(expenses: Expense[], apartments: Apartment[]): Promise<string> {
  const expenseData = JSON.stringify(expenses);
  const apartmentData = JSON.stringify(apartments);
  
  const prompt = `Както експерт по управление на етажна собственост, анализирай следните данни за разходи и апартаменти в една жилищна кооперация. 
  ВАЖНИ ПРАВИЛА: 
  1. Апартаментите на 1-ви етаж не заплащат такси за асансьор.
  2. Домашните любимци се таксуват като един допълнителен живущ за общите разходи.
  
  Разходи: ${expenseData}. 
  Апартаменти: ${apartmentData}.
  
  Направи кратък анализ на български език:
  1. Кои са най-големите пера в разходите?
  2. Има ли притеснителни задължения от страна на собствениците, като вземеш предвид броя живущи (вкл. домашни любимци)?
  3. Дай 3 конкретни препоръки за оптимизация на бюджета.
  Бъди кратък и професионален.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "Не можах да генерирам анализ в момента.";
  } catch (error) {
    console.error("AI Analysis error:", error);
    return "Грешка при комуникация с AI асистента.";
  }
}

export async function generateNotice(topic: string): Promise<string> {
  const prompt = `Напиши официално съобщение за входа на жилищна кооперация на тема: ${topic}. Стилът трябва да е учтив, но ясен. Включи места за попълване на дата и час (в скоби).`;
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "Не можах да генерирам съобщение.";
  } catch (error) {
    return "Грешка при генериране на съобщение.";
  }
}
